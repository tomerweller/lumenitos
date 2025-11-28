# Claude Code Guidelines for Lumenitos

## Git Workflow

### Push Policy
**IMPORTANT**: Never push to remote repository automatically or proactively.

- Only push when explicitly requested by the user
- Valid push requests include:
  - "push"
  - "commit and push"
  - "push to remote"
  - Any explicit instruction to push changes
- **NEVER use force push** (git push -f or git push --force)
  - Force push can destroy history and cause data loss
  - If push is rejected, inform user and ask how to proceed
  - Exception: Only use force push if user explicitly requests it with clear understanding

### Commit Policy
**IMPORTANT**: Never commit automatically or proactively.

- Only commit when explicitly requested by the user
- Valid commit requests include:
  - "commit"
  - "commit this"
  - "commit and push"
  - Any explicit instruction to commit changes
- Use descriptive commit messages following existing style
- Do not use --no-verify or skip hooks

### Standard Workflow
1. Make changes to files as requested
2. Test changes if applicable
3. **WAIT** for explicit commit instruction
4. Commit locally with clear message when requested
5. **WAIT** for explicit push instruction
6. Before pushing, check if README.md is up to date with changes
   - Review README.md against recent changes
   - Suggest updates if features/behavior changed
   - Update README if needed before pushing
7. Only push when user requests it

## Code Style

### General
- Follow existing code patterns in the project
- Use the monospace font family for consistency
- Maintain minimalist UI approach

### React/Next.js
- Use functional components with hooks
- Keep state management simple with useState
- Use localStorage for client-side persistence
- Follow existing naming conventions

### Stellar Integration
- Use Stellar SDK for all blockchain operations
- Use Soroban RPC for balance queries and simulations
- Handle errors by throwing, not returning default values
- Always validate addresses before operations

## Testing
- Test on testnet only (this is an experimental wallet)
- Never use real funds
- Verify operations in Stellar Explorer

## Documentation
- Keep README.md up to date with new features
- Document breaking changes
- Add comments for complex logic (e.g., XDR parsing, TTL calculations)

### Debugging and Implementation Notes
If a feature required non-trivial time and debugging to implement:
- Explain what the issues were with the libraries, tools, and documentation used
- Document workarounds or non-obvious solutions
- Note any gaps or misleading information in official documentation
- Help improve understanding for future development and debugging

## Security Notes
- This is an experimental wallet - not production ready
- Private keys stored in localStorage (not secure)
- Only for testnet use
- Never commit sensitive data (API keys, etc.)
