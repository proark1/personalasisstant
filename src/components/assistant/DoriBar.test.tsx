import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DoriBar } from "./DoriBar";

vi.mock("@/hooks/useNextUp", () => ({
  useNextUp: () => ({ items: [] as never[], loading: false }),
}));

// Controllable voice recognition.
const startListening = vi.fn();
const stopListening = vi.fn();
let voiceState = { isListening: false, isSupported: true };
let onTranscriptCb: ((t: string, isFinal: boolean) => void) | undefined;
vi.mock("@/hooks/useVoiceRecognition", () => ({
  useVoiceRecognition: (opts: { onTranscript?: (t: string, isFinal: boolean) => void }) => {
    onTranscriptCb = opts.onTranscript;
    return { ...voiceState, transcript: "", startListening, stopListening };
  },
}));

// Controllable Dori conversation context.
const send = vi.fn();
let doriState: Record<string, unknown> = {};
vi.mock("@/contexts/DoriConversationContext", () => ({
  useDoriConversation: () => ({
    messages: [] as never[],
    isProcessing: false,
    thinkingStatus: undefined as string | undefined,
    actionCards: [] as never[],
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    send,
    publish: vi.fn(),
    registerSend: vi.fn(),
    ...doriState,
  }),
}));

describe("DoriBar", () => {
  beforeEach(() => {
    send.mockClear();
    startListening.mockClear();
    stopListening.mockClear();
    doriState = {};
    voiceState = { isListening: false, isSupported: true };
  });

  it("sends the typed text to Dori on Enter and clears the input", () => {
    const { getByLabelText } = render(<DoriBar onVoiceMode={vi.fn()} />);
    const input = getByLabelText("Ask Dori anything") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "add milk to my shopping list" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).toHaveBeenCalledWith("add milk to my shopping list");
    expect(input.value).toBe("");
  });

  it("does not send empty/whitespace input", () => {
    const { getByLabelText } = render(<DoriBar onVoiceMode={vi.fn()} />);
    const input = getByLabelText("Ask Dori anything");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
  });

  it("starts inline dictation from the mic when speech is supported", () => {
    const onVoiceMode = vi.fn();
    const { getByLabelText } = render(<DoriBar onVoiceMode={onVoiceMode} />);
    fireEvent.click(getByLabelText("Talk to Dori"));
    expect(startListening).toHaveBeenCalledOnce();
    expect(onVoiceMode).not.toHaveBeenCalled();
  });

  it("falls back to full voice mode when speech recognition is unsupported", () => {
    voiceState = { isListening: false, isSupported: false };
    const onVoiceMode = vi.fn();
    const { getByLabelText } = render(<DoriBar onVoiceMode={onVoiceMode} />);
    fireEvent.click(getByLabelText("Talk to Dori"));
    expect(onVoiceMode).toHaveBeenCalledOnce();
    expect(startListening).not.toHaveBeenCalled();
  });

  it("auto-sends a final dictation transcript to Dori", () => {
    render(<DoriBar onVoiceMode={vi.fn()} />);
    onTranscriptCb?.("remind me to call mom", true);
    expect(send).toHaveBeenCalledWith("remind me to call mom");
  });

  it("renders the inline conversation popover when open with messages", () => {
    doriState = {
      isOpen: true,
      messages: [{ id: "1", role: "user", content: "hello dori", timestamp: new Date() }],
    };
    const { getByText, getByLabelText } = render(<DoriBar onVoiceMode={vi.fn()} />);
    expect(getByText("hello dori")).toBeInTheDocument();
    expect(getByLabelText("Close Dori conversation")).toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    const { container } = render(<DoriBar onVoiceMode={vi.fn()} hidden />);
    expect(container.firstChild).toBeNull();
  });
});
