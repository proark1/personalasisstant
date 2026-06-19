// Re-exports from AuthContext for backward compatibility
// All 91+ consumers continue to work unchanged
export { useAuthContext as useAuth } from "@/contexts/AuthContext";
export type { Profile } from "@/contexts/AuthContext";
