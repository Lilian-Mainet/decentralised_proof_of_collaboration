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
