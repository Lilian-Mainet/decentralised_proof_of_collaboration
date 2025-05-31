;; Proof of Collaboration Protocol
;; Written in Clarity for Stacks blockchain

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-verified (err u102))

;; Define contribution tiers
(define-constant BRONZE u1)
(define-constant SILVER u2)
(define-constant GOLD u3)
(define-constant PLATINUM u4)

;; Define tier thresholds
(define-constant SILVER-THRESHOLD u100)
(define-constant GOLD-THRESHOLD u250)
(define-constant PLATINUM-THRESHOLD u500)

;; Data maps for storing contributor and contribution information
(define-map Contributors
    principal
    {
        total-score: uint,
        contribution-count: uint,
        tier: uint,
        is-active: bool,
    }
)

(define-map Contributions
    uint
    {
        contributor: principal,
        timestamp: uint,
        details: (string-utf8 256),
        score: uint,
        verified: bool,
    }
)

(define-map project-admins
    principal
    bool
)

;; Data variable to keep track of contribution IDs
(define-data-var contribution-counter uint u0)


;; Initialize contract
(define-public (initialize)
    (begin
        (map-set project-admins contract-owner true)
        (ok true)
    )
)

;; Add project admin
(define-public (add-project-admin (admin principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (map-set project-admins admin true))
    )
)

;; Submit new contribution
(define-public (submit-contribution (details (string-utf8 256)))
    (let
        (
            (contribution-id (+ (var-get contribution-counter) u1))
            (contributor tx-sender)
        )
        (begin
            (var-set contribution-counter contribution-id)
            (map-set Contributions contribution-id
                {
                    contributor: contributor,
                    timestamp: block-height,
                    details: details,
                    score: u0,
                    verified: false
                }
            )
            (match (map-get? Contributors contributor)
                prev-profile (map-set Contributors contributor 
                    {
                        total-score: (get total-score prev-profile),
                        contribution-count: (+ (get contribution-count prev-profile) u1),
                        tier: (get tier prev-profile),
                        is-active: true
                    })
                (map-set Contributors contributor
                    {
                        total-score: u0,
                        contribution-count: u1,
                        tier: BRONZE,
                        is-active: true
                    }
                )
            )
            (ok contribution-id)
        )
    )
)

;; Verify contribution and assign score
(define-public (verify-contribution (contribution-id uint) (score uint))
    (let
        ((contribution (unwrap! (map-get? Contributions contribution-id) err-not-found)))
        (begin
            ;; Fix: Use default-to to handle the optional boolean value
            (asserts! (default-to false (map-get? project-admins tx-sender)) err-owner-only)
            (asserts! (not (get verified contribution)) err-already-verified)
            
            ;; Update contribution
            (map-set Contributions contribution-id
                (merge contribution { score: score, verified: true })
            )
            
            ;; Update contributor profile
            (match (map-get? Contributors (get contributor contribution))
                prev-profile (begin
                    (map-set Contributors (get contributor contribution)
                        (merge prev-profile
                            {
                                total-score: (+ (get total-score prev-profile) score)
                            }
                        )
                    )
                    (ok true)
                )
                err-not-found
            )
        )
    )
)

;; Calculate and update contributor tier
(define-public (update-contributor-tier (contributor principal))
    (match (map-get? Contributors contributor)
        profile (let
            ((total-score (get total-score profile)))
            (begin
                (map-set Contributors contributor
                    (merge profile
                        {
                            tier: (if (>= total-score PLATINUM-THRESHOLD)
                                    PLATINUM
                                    (if (>= total-score GOLD-THRESHOLD)
                                        GOLD
                                        (if (>= total-score SILVER-THRESHOLD)
                                            SILVER
                                            BRONZE)))
                        }
                    )
                )
                (ok true)
            ))
        err-not-found
    )
)

;; Read-only functions
(define-read-only (get-contribution (contribution-id uint))
    (map-get? Contributions contribution-id)
)

(define-read-only (get-contributor-profile (contributor principal))
    (map-get? Contributors contributor)
)

(define-read-only (get-contributor-tier (contributor principal))
    (match (map-get? Contributors contributor)
        profile (ok (get tier profile))
        err-not-found
    )
)

(define-read-only (is-project-admin (address principal))
    (default-to false (map-get? project-admins address))
)