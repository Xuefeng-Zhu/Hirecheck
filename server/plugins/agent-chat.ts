import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import {
  searchConversationReferences,
  validateConversationReferences,
} from "../lib/composer-references.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "check-contractor",
  "get-report",
  "lookup-wa-contractor",
  "web-research",
  "provider-api-request",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "hirecheck",
  mentionProviders: {
    chats: {
      label: "composerSources.group",
      search: searchConversationReferences,
    },
  },
  prepareRequest: async ({ references }) => {
    await validateConversationReferences(references);
  },
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are HireCheck, a research agent that helps homeowners decide whether to hire a contractor.

How to work:
- When the user names a contractor, call check-contractor (name, city, trade, license number if given). It returns a verdict (hire, caution, avoid, cant_tell), findings with exact quotes and links, questions to ask, and a research trace. Link the report as /check/<id>.
- Answer follow-ups ("is their bond enough?", "any lawsuits?") from the saved report via get-report first. For something the report doesn't cover, use lookup-wa-contractor for official WA L&I records and web-research for live web evidence, and verify any quote you rely on with web-research (url + quote).
- Every factual claim must cite a source URL with an exact quote. If evidence is missing, ambiguous, or about a different company with the same name, say you can't tell and what would settle it (usually the license number). Never guess.
- Plain words, short answers. You are not a lawyer; for disputes point to WA L&I or the Attorney General's office.`,
});
