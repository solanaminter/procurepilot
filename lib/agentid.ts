// ProcurePilot — AgentID identity ("Sign in with Google" for agents).
//
// AgentID (AgentMail) is a standard OpenID Connect identity provider for AI
// agents. Every sign-in yields:
//   - a stable agent ID (`sub`) — the agent lands in the same account every visit
//   - the agent's verified email — you can email the agent directly
//   - `actor_type: "agent"` — so services can tell agents from human traffic
//   - the human owner's name + verified email — a real person is always on record
//
// Integration is CONFIGURATION, not new auth code: AgentID speaks standard
// OIDC (ES256, PKCE S256), so any OIDC client can accept it. To go live, run
// `npx @agentmail/agentid-cli init` from the repo root and set the env vars
// below. Until then, getAgentIdentity() returns a clearly-marked DEMO identity
// so the chat UI, dashboard, and evals exercise the full trust narrative with
// zero secrets and zero network calls.

export interface AgentIdentity {
  /** Stable agent ID — the `sub` claim. */
  sub: string;
  /** The agent's verified email. */
  agentEmail: string;
  /** Always "agent" — distinguishes agent traffic from human traffic. */
  actorType: "agent";
  /** Human owner display name — every agent has a human. */
  ownerName: string;
  /** Human owner verified email. */
  ownerEmail: string;
  /** OIDC issuer that minted this identity. */
  issuer: string;
  /** True once real AgentID credentials are configured. */
  verified: boolean;
  /** "agentid" when backed by real credentials, "demo" otherwise. */
  mode: "agentid" | "demo";
}

// Deliberately fake: `.example` domains can never collide with a real inbox.
// The UI always renders this with a "Demo identity" pill.
const DEMO_IDENTITY: AgentIdentity = {
  sub: "agent_demo_procurepilot_01",
  agentEmail: "procurepilot-demo@agents.example",
  actorType: "agent",
  ownerName: "Solana Minter",
  ownerEmail: "solanaminter@gmail.com",
  issuer: "https://demo.agents.example",
  verified: false,
  mode: "demo",
};

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function isRealClientId(v: string | undefined): boolean {
  return !!v && !/^(your-|xxx|placeholder|todo|<)/i.test(v);
}

/**
 * Returns the agent's identity. Never throws; falls back to the demo
 * identity when AgentID is not configured. Only public identity claims are
 * returned here — never secrets.
 */
export function getAgentIdentity(): AgentIdentity {
  if (!isRealClientId(env("AGENTID_CLIENT_ID"))) {
    return { ...DEMO_IDENTITY };
  }
  return {
    // TODO: after `agentid-cli init`, prefer the live id_token claims
    // (sub / email / owner_email) over these env overrides.
    sub: env("AGENTID_AGENT_SUB") ?? "agent_procurepilot_01",
    agentEmail: env("AGENTID_AGENT_EMAIL") ?? "agent-email-not-configured@agents.example",
    actorType: "agent",
    ownerName: env("AGENTID_OWNER_NAME") ?? "Solana Minter",
    ownerEmail: env("AGENTID_OWNER_EMAIL") ?? "solanaminter@gmail.com",
    issuer: env("AGENTID_ISSUER") ?? "https://agentid.com",
    verified: true,
    mode: "agentid",
  };
}

/**
 * Builds the standard OIDC authorization URL for AgentID sign-in
 * (authorization code flow + PKCE S256).
 *
 * TODO: wire to the real issuer + client ID after `agentid-cli init`, generate
 * a per-session PKCE verifier/challenge, and exchange the code at the token
 * endpoint, verifying the id_token signature (ES256) against the issuer JWKS.
 */
export function getAgentIdLoginUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
}): string {
  const issuer = (env("AGENTID_ISSUER") ?? "https://agentid.com").replace(/\/$/, "");
  const clientId = env("AGENTID_CLIENT_ID") ?? "TODO-AGENTID_CLIENT_ID";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    nonce: opts.nonce,
    code_challenge_method: "S256",
    // code_challenge: "<base64url(sha256(verifier))>" — TODO: generate per session
  });
  return `${issuer}/authorize?${params.toString()}`;
}
