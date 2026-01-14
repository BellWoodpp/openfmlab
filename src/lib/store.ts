import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface AppState {
  voice: string;
  tone: "neutral" | "calm" | "serious" | "cheerful" | "excited" | "surprised";
  speakingRateMode: "auto" | "custom";
  speakingRate: number;
  playbackRate: number;
  volumeGainDb: number;
  input: string;
  customTitleEnabled: boolean;
  customTitle: string;
  codeView: string;
  latestAudioId: string | null;
  latestAudioUrl: string | null;
  latestAudioBlobUrl: string | null;
  ttsHistory: Array<{
    id: string;
    createdAt: string;
    title?: string | null;
    voice: string;
    tone: AppState["tone"];
    audioUrl: string;
    tokensUsed: number;
  }>;
}

const DEFAULT_VOICE = "en-US-Standard-C";

const INITIAL_STATE: AppState = {
  voice: DEFAULT_VOICE,
  tone: "neutral",
  speakingRateMode: "auto",
  speakingRate: 1,
  playbackRate: 1,
  volumeGainDb: 0,
  input: "",
  customTitleEnabled: false,
  customTitle: "",
  codeView: "py",
  latestAudioId: null,
  latestAudioUrl: null,
  latestAudioBlobUrl: null,
  ttsHistory: [],
};

class AppStore {
  private store = create(immer(() => INITIAL_STATE));

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.slice(1);
    if (!hash) {
      return;
    }

    fetch(`/api/share?hash=${hash}`)
      .then((res) => {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          this.store.setState((draft) => {
            draft.input = data.input;
            draft.voice = data.voice;
            draft.tone = "neutral";
            draft.speakingRateMode = "auto";
            draft.speakingRate = 1;
            draft.playbackRate = 1;
            draft.volumeGainDb = 0;
            draft.latestAudioId = null;
            draft.latestAudioUrl = null;
            draft.latestAudioBlobUrl = null;
            draft.ttsHistory = [];
          });
        }
      })
      .catch((err) => {
        console.error("Error loading shared params:", err);
      });
  }

  useState = this.store;
  setState = this.store.setState;
  getState = this.store.getState;
  subscribe = this.store.subscribe;
}

export const appStore = new AppStore() as Readonly<AppStore>;
