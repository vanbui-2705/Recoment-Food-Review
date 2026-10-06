## Purpose

Support account-owned multi-turn discovery conversations with reconnectable streaming and controlled tools while keeping transactions Coming soon.

## ADDED Requirements

### Requirement: Private streaming conversations
The system SHALL expose owner-only conversation history and authenticated streaming with resumable event sequence, cancellation and idempotent message submission.

#### Scenario: Disconnected stream
- **WHEN** the owner reconnects after a stream disconnect
- **THEN** available events resume without duplicating the submitted message or leaking another account's conversation

### Requirement: Bounded discovery tools
The assistant SHALL call only authorized discovery/profile tools using backend-injected user identity and bounded calls, and SHALL ask for missing required context.

#### Scenario: Injected user identity
- **WHEN** model output requests another user's profile or an unauthorized tool
- **THEN** the backend rejects the tool request and no unauthorized data is returned

### Requirement: Coming soon transactions
The system SHALL present cart/order/payment/delivery as Coming soon and SHALL NOT register transactional assistant tools or create transactional records in this release.

#### Scenario: User asks to place an order
- **WHEN** the user asks the assistant to order or pay
- **THEN** the assistant states Coming soon and can offer restaurant details or directions without submitting a transaction
