## Lead AI Modules

Lightweight TypeScript utilities for outbound calling (VAPI), SMS (Telnyx), and email (Microsoft Graph + Gmail) designed for server-side Node.js environments.

### Features

- Initiate VAPI calls with a custom payload
- Initiate calls using the most recent active Supabase agent and VAPI integration
- Send SMS via Telnyx
- Send email via Microsoft Graph (Outlook)
- Send email via Gmail API with automatic token refresh using stored credentials in Supabase

### Method categories

- Core SDK (no Supabase required): `initiateCall`, `sendSMS`, `sendOutlookMail`
- App-specific (Supabase-backed): `initiateCallUsingRecentActiveAgent`, `sendEmailFromStageTask`

### Requirements

- Node.js 18+
- TypeScript 5+
- You manage peer dependencies in your app (this package declares them as peerDependencies):
  - `@supabase/supabase-js`
  - `@microsoft/microsoft-graph-client`
  - `googleapis`

Note: Supabase is only needed if you use the App-specific (Supabase-backed) methods, but it is declared as a peer dependency of this package.

### Install

```bash
npm install lead-ai-npm-modules @supabase/supabase-js @microsoft/microsoft-graph-client googleapis
```

### Build (for contributors)

```bash
npm run build
```

## Usage

All examples assume server-side execution. Do not expose secrets to the browser.

### Core SDK (no Supabase)

### Initiate a VAPI call

```ts
import { initiateCall } from "lead-ai-npm-modules";

async function run() {
  const payload = {
    assistant: {
      name: "Agent Smith",
      firstMessage: "Hello!",
    },
    type: "outboundPhoneCall",
    phoneNumberId: "pn_123",
    customer: { number: "+15551234567" },
  };

  const result = await initiateCall(payload, process.env.VAPI_API_KEY!);
  console.log(result);
}
```

### Send SMS with Telnyx

```ts
import { sendSMS } from "lead-ai-npm-modules";

async function run() {
  const telnyxApiKey = process.env.TELNYX_API_KEY!;
  const result = await sendSMS(
    "+15551234567",
    "Hello from LeadAI!",
    telnyxApiKey
  );
  console.log(result);
}
```

Note: The current implementation uses a hard-coded `from` number and `messaging_profile_id`.

### Send email with Microsoft Graph (Outlook)

```ts
import { sendOutlookMail } from "lead-ai-npm-modules";

async function run() {
  const accessToken = process.env.MS_GRAPH_ACCESS_TOKEN!;
  const response = await sendOutlookMail(
    accessToken,
    "user@example.com",
    "Hello from LeadAI!"
  );
  console.log(response);
}
```

### App-specific (Supabase-backed)

The following methods use Supabase and expect specific tables and records to exist in your application database. Treat them as app-level helpers that you may adapt to your own schema.

#### Initiate a call using the most recent active agent (Supabase + VAPI)

Looks up the latest active agent for a `client_id` and its associated `vapi_integration` in Supabase, then starts a call via VAPI.

```ts
import { initiateCallUsingRecentActiveAgent } from "lead-ai-npm-modules";

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
  const clientId = "10000002";
  const phoneNumber = "+15551234567";
  const script = "You are calling to confirm the appointment.";

  const result = await initiateCallUsingRecentActiveAgent(
    supabaseUrl,
    supabaseAnonKey,
    clientId,
    phoneNumber,
    script
  );
  console.log(result);
}
```

Expected Supabase schema (tables/columns used):

- Schema `lead_dialer`
  - Table `agents`: `id`, `name`, `is_active`, `client_id`, `agent_type`, `created_at`
  - Table `vapi_integration`: includes VAPI configuration fields like `auth_token`, `phoneNumberId`, `phoneNumber`, optional model/voice/transcriber/settings

### Send email from stage task (Gmail or Outlook via stored credentials in Supabase)

Refreshes tokens if expired and sends using Gmail API or Microsoft Graph, based on the `emails` record in Supabase. Requires environment variables for Supabase and OAuth client credentials as function arguments.

```ts
import { sendEmailFromStageTask } from "lead-ai-npm-modules";

async function run() {
  const result = await sendEmailFromStageTask(
    "10000002",
    "stage-sender@example.com",
    "Hello from LeadAI via stage task!",
    "recipient@example.com",
    process.env.MS_CLIENT_ID!,
    process.env.MS_CLIENT_SECRET!,
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );

  console.log(result);
}
```

Supabase requirements for `sendEmailFromStageTask`:

- Table `emails` with columns: `email`, `client_id`, `provider` ('azure-ad' or 'google'), `access_token`, `refresh_token`, `expires_at` (epoch seconds)

## API Reference

### Core SDK

#### initiateCall

Initiates a VAPI call using a provided payload and VAPI auth token.

```ts
function initiateCall(
  phoneCallPayload: Record<string, unknown>,
  authToken: string
): Promise<unknown>;
```

#### sendSMS

Sends an SMS via Telnyx.

```ts
function sendSMS(
  phone_number: string,
  smsBody: string,
  telnyxApiKey: string
): Promise<unknown | null>;
```

#### sendOutlookMail

Sends an email using Microsoft Graph with a valid OAuth access token.

```ts
function sendOutlookMail(
  accessToken: string,
  email: string,
  emailBody: string
): Promise<string>;
```

### App-specific (Supabase-backed)

#### initiateCallUsingRecentActiveAgent

Looks up agent and VAPI configuration in Supabase, builds the payload, then initiates a VAPI call.

```ts
function initiateCallUsingRecentActiveAgent(
  supabaseUrl: string,
  supabaseAnonKey: string,
  client_id: string,
  phone_number: string,
  script: string
): Promise<unknown>;
```

#### sendEmailFromStageTask

Sends an email using stored credentials in Supabase (refreshes token if expired). Uses Outlook (Graph) when `provider === 'azure-ad'`, otherwise Gmail.

```ts
function sendEmailFromStageTask(
  client_id: string,
  stage_email: string,
  emailBody: string,
  recipientEmail: string,
  microsoftClientId: string,
  microsoftClientSecret: string,
  googleClientId: string,
  googleClientSecret: string
): Promise<string | unknown | null>;
```

## Configuration

### Core SDK

- `VAPI_API_KEY`: VAPI auth token (server only)
- `TELNYX_API_KEY`: Telnyx API key (server only)
- `MS_GRAPH_ACCESS_TOKEN`: Access token for Microsoft Graph (if calling `sendOutlookMail`)

### App-specific (Supabase-backed)

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*` variants when used server-side)
- OAuth credentials passed as arguments to `sendEmailFromStageTask`:
  - `MS_CLIENT_ID`, `MS_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Security notes

- Run these utilities on the server; never expose secrets to the browser.
- If you fork/extend, avoid embedding hard-coded numbers or IDs; pass them as parameters or environment variables.

## TypeScript

- Types are emitted with the build and referenced via `types` in `package.json`.
- The package targets CommonJS (`dist/index.js`) for broad Node.js compatibility.

## License

MIT © Lead AI
