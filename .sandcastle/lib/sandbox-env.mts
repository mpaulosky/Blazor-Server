// Sandcastle passes every key in .sandcastle/.env into the sandbox, taking the
// value from the host's environment when the file leaves it blank. So a
// GH_TOKEN line there, even an empty one, hands the host's GitHub token to the
// agents. The host refuses to start while one is present.

const githubTokens = new Set(["GH_TOKEN", "GITHUB_TOKEN"]);

// GitHub token keys the env file content defines, in file order.
export function githubTokensIn(envFile: string): string[] {
  const found: string[] = [];
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (githubTokens.has(key)) found.push(key);
  }
  return found;
}
