import axios from "axios";

const LINKEDIN_API = "https://api.linkedin.com/v2";

export function linkedinHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

/**
 * Resolves the member author URN for UGC posts. Uses OpenID userinfo because
 * Sign In with LinkedIn (openid + profile) tokens often cannot call /v2/me.
 */
export async function getPersonUrn(accessToken: string): Promise<string> {
  const { data } = await axios.get<{ sub: string }>(
    `${LINKEDIN_API}/userinfo`,
    { headers: linkedinHeaders(accessToken) },
  );
  const sub = data.sub?.trim();
  if (!sub) {
    throw new Error("LinkedIn userinfo response missing sub");
  }
  if (sub.startsWith("urn:li:person:")) {
    return sub;
  }
  return `urn:li:person:${sub}`;
}
