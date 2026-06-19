import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "true") {
      setStatus("success");
      // Auto-redirect after 2 seconds
      const timer = setTimeout(() => {
        navigate("/?tab=settings");
      }, 2000);
      return () => clearTimeout(timer);
    } else if (error) {
      setStatus("error");
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        access_denied: "You denied access to your calendar.",
        token_exchange_failed: "Failed to authenticate with Google. Please try again.",
        calendar_fetch_failed: "Could not fetch your calendars. Please try again.",
        no_calendars_found: "No calendars found in your Google account.",
        db_insert_failed: "Failed to save the connection. Please try again.",
        db_update_failed: "Failed to update the connection. Please try again.",
        missing_params: "Missing required parameters. Please try again.",
        invalid_state: "Invalid request. Please try again.",
        unsupported_provider: "This calendar provider is not supported yet.",
        unexpected_error: "An unexpected error occurred. Please try again.",
      };
      setErrorMessage(errorMessages[error] || "An unknown error occurred.");
    } else {
      // No params yet, still loading
      setStatus("loading");
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "loading" && (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Connecting Calendar...
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="h-6 w-6 text-green-500" />
                Calendar Connected!
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-6 w-6 text-destructive" />
                Connection Failed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we connect your calendar..."}
            {status === "success" && "Your Google Calendar has been connected successfully."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === "success" && (
            <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
          )}
          {status === "error" && (
            <Button onClick={() => navigate("/?tab=settings")} variant="outline">
              Back to Settings
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
