# TanStack AI self-editing demo

This is a TanStack Start app using Vite+. The control page sends prompts through TanStack AI to the OpenCode harness in a Vercel Sandbox. The sandbox clones this repository, so edits stay outside the local control app. `/canvas` is the page the agent is meant to change.

## Local development

```sh
vp install
vp dev
```

Open `http://localhost:3000`. The page and its local starter preview work without credentials. The **Launch sandbox** button creates a remote sandbox only when clicked. Once configured, sending a prompt also creates or resumes the sandbox for the local demo thread.

## Sandbox configuration

Copy `.env.example` to `.env.local` and fill in:

- `DEMO_REPOSITORY_URL` is optional. The app defaults to this repository's GitHub URL; set it when using a fork. Push the app changes before launching a preview, since the sandbox clones the remote branch.
- `OPENCODE_MODEL`: an OpenCode `provider/model` ID.
- For local Vercel authentication, link a Vercel project with `vercel link`, then run `vercel env pull` to write `VERCEL_OIDC_TOKEN` to `.env.local`. Alternatively, set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`. A Sandbox CLI login alone may not populate these environment variables for this Node process.
- The API key for the chosen model provider. The current setup passes `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and `OPENROUTER_API_KEY` when present into the sandbox.

The sandbox setup installs OpenCode and pnpm, clones the repository, and installs dependencies. The preview starts Vite+ on port 5173. OpenCode uses `acceptEdits`, which permits file changes but denies shell commands that ask for approval. The control app starts the preview server itself. This is a single-user local demo; add authentication, durable instance storage, and run controls before deploying it for other users.

## Validation

```sh
vp check
vp test
vp build
```

There are no test files in the base template yet, so `vp test` currently reports that it found no tests.
