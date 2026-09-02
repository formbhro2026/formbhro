import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Database } from "@/integrations/supabase/types";
import { Loader2 } from "lucide-react";

type Policy = Database["public"]["Tables"]["policies"]["Row"];

type CachedPolicyAck = {
  ackedAt: number;
  allAcknowledged: boolean;
};

const POLICY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getPolicyCache(userId: string): CachedPolicyAck | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = sessionStorage.getItem(`formbhro:policy_ack:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPolicyAck;
    if (parsed && typeof parsed.ackedAt === "number" && Date.now() - parsed.ackedAt < POLICY_CACHE_TTL_MS) {
      return parsed;
    }
  } catch {}
  return null;
}

function setPolicyCache(userId: string, allAcknowledged: boolean) {
  if (typeof window === "undefined" || !userId) return;
  try {
    sessionStorage.setItem(
      `formbhro:policy_ack:${userId}`,
      JSON.stringify({ ackedAt: Date.now(), allAcknowledged }),
    );
  } catch {}
}

export function PolicyInterceptor({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useSession();
  const [unacknowledgedPolicies, setUnacknowledgedPolicies] = useState<Policy[]>([]);
  const cachedAck = user ? getPolicyCache(user.id) : null;
  // If we already have a valid local cache stating all policies are acknowledged, unblock UI immediately
  const [loading, setLoading] = useState(() => !cachedAck || !cachedAck.allAcknowledged);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      setUnacknowledgedPolicies([]);
      setLoading(false);
      return;
    }

    const currentCached = getPolicyCache(user.id);
    const hasCachedAck = currentCached?.allAcknowledged ?? false;

    async function checkPolicies() {
      // Only show blocking loader if not already validated in cache
      if (!hasCachedAck) {
        setLoading(true);
      }
      setError(null);
      try {
        // Parallelize active policies and user acknowledgments queries
        const [activePoliciesRes, acksRes] = await Promise.all([
          supabase.from("policies").select("*").eq("is_active", true),
          supabase.from("policy_acknowledgments").select("policy_id").eq("user_id", user!.id),
        ]);

        if (activePoliciesRes.error) throw activePoliciesRes.error;
        if (acksRes.error) throw acksRes.error;

        const activePolicies = activePoliciesRes.data ?? [];
        const acks = acksRes.data ?? [];

        if (activePolicies.length === 0) {
          setUnacknowledgedPolicies([]);
          setPolicyCache(user!.id, true);
          setLoading(false);
          return;
        }

        const ackedPolicyIds = new Set(acks.map((a) => a.policy_id));
        const unacked = activePolicies.filter((p) => !ackedPolicyIds.has(p.id));

        setUnacknowledgedPolicies(unacked);
        setPolicyCache(user!.id, unacked.length === 0);
      } catch (err) {
        const error = err as Error;
        console.error("Error checking policies:", error);
        if (!hasCachedAck) {
          setError("Failed to verify policy status. Please refresh the page.");
        }
      } finally {
        setLoading(false);
      }
    }

    void checkPolicies();
  }, [user, initialized]);

  const handleAcknowledgeAll = async () => {
    if (!user || unacknowledgedPolicies.length === 0) return;

    setAcknowledging(true);
    setError(null);
    try {
      const inserts = unacknowledgedPolicies.map((p) => ({
        user_id: user.id,
        policy_id: p.id,
      }));

      const { error } = await supabase.from("policy_acknowledgments").insert(inserts);

      if (error) throw error;

      setUnacknowledgedPolicies([]);
      setPolicyCache(user.id, true);
    } catch (err) {
      const error = err as Error;
      console.error("Error acknowledging policies:", error);
      setError("Failed to acknowledge policies. Please try again.");
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (unacknowledgedPolicies.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
        <div className="w-full max-w-2xl bg-card border border-border/50 shadow-2xl rounded-xl flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-border/50 shrink-0">
            <h2 className="text-xl font-bold text-text-primary">Action Required: Policy Updates</h2>
            <p className="text-sm text-text-secondary mt-1">
              Please review and accept our updated policies to continue using the application.
            </p>
          </div>

          <div className="p-6 overflow-y-auto space-y-8">
            {unacknowledgedPolicies.map((policy) => (
              <div key={policy.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold capitalize text-text-primary">
                    {policy.type}
                  </h3>
                  <span className="text-xs text-text-muted font-mono bg-background px-2 py-1 rounded">
                    Version: {policy.version}
                  </span>
                </div>
                <div className="prose prose-invert max-w-none text-sm text-text-secondary bg-background p-4 rounded-lg border border-border/50 whitespace-pre-wrap">
                  {policy.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t border-border/50 shrink-0 bg-card/50">
            {error && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}
            <Button
              onClick={handleAcknowledgeAll}
              disabled={acknowledging}
              className="w-full h-11 text-base font-medium"
            >
              {acknowledging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "I have read and agree to these policies"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
