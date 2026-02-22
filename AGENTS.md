# Repository Agent Rules

## Critical AWS Safety Rule

- Do not execute any AWS-related scripts or commands without explicit user approval in the current conversation.
- This includes (but is not limited to): `aws ...`, `terraform ...`, deployment scripts, or any automation that mutates AWS resources.
- Default behavior is read-only/local work only. If AWS action is needed, first present the exact command and wait for user confirmation.
