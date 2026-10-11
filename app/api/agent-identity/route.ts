// ProcurePilot — agent identity endpoint.
// GET /api/agent-identity → { identity: AgentIdentity }
// Serves only public identity claims (sub, agent email, actor_type, owner) —
// never secrets. The chat UI and dashboard fetch this to render the badge.

import { getAgentIdentity } from "@/lib/agentid";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ identity: getAgentIdentity() });
}
