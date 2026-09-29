// AUTO-GENERIERT aus packages/contracts (npm run gen). Nicht von Hand aendern.
/**
 * Avatar-Paket = .riv + manifest.json mit festem Input-Vertrag.
 */
export interface AvatarManifest {
  manifest_version: "1.0.0";
  id: string;
  name: string;
  riv_file: string;
  state_machine: string;
  inputs: {
    viseme: {
      name: string;
      min: 0;
      max: 21;
    };
    emotion: {
      name: string;
      /**
       * @minItems 7
       * @maxItems 7
       */
      values: [
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate",
        ...("neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate")[]
      ];
    };
    gaze_x: {
      name: string;
    };
    gaze_y: {
      name: string;
    };
    speaking: {
      name: string;
    };
  };
  outfit_slots?: {
    slot: "hat" | "glasses" | "top" | "background";
    input: string;
    variants?: number;
  }[];
  license?: string;
}
/**
 * Semantische Events Backend -> Frontend. Keine UI-Anweisungen. Aussehen, Klang und Haptik entscheidet das Frontend.
 */
export type LearniEvent = {
  event_version: "1.0.0";
  type: string;
  ts: string;
  payload: {};
} & (
  | {
      type?: "answer.evaluated";
      payload?: {
        exercise_id: string;
        correct: boolean;
        decidable: boolean;
        hearts_lost: number;
        feedback_key: string;
        correct_answer?: string | unknown[] | null;
        pronunciation_score?: number | null;
      };
    }
  | {
      type?: "reward.granted";
      payload?: {
        kind: "xp" | "heart" | "streak_freeze" | "trophy";
        amount: number;
        reason?: string;
        trophy_id?: string;
      };
    }
  | {
      type?: "hearts.changed";
      payload?: {
        hearts: number;
        max_hearts: number | null;
        unlimited?: boolean;
      };
    }
  | {
      type?: "hearts.empty";
      payload?: {
        paywall_trigger?: "hearts_empty";
      };
    }
  | {
      type?: "streak.updated";
      payload?: {
        days: number;
        freeze_used: boolean;
        at_risk?: boolean;
      };
    }
  | {
      type?: "level.up";
      payload?: {
        language: string;
        level: string;
        skill?: string;
      };
    }
  | {
      type?: "daily_goal.reached";
      payload?: {
        xp: number;
      };
    }
  | {
      type?: "lesson.completed";
      payload?: {
        xp_gained: number;
        mistakes: number;
        minutes: number;
      };
    }
  | {
      type?: "avatar.speak";
      payload?: {
        text: string;
        audio_url: string | null;
        visemes: {
          t_ms: number;
          viseme: number;
        }[];
        emotion: "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate";
        mock?: boolean;
      };
    }
  | {
      type?: "budget.limited";
      payload?: {
        reason: "ai_minutes" | "cost_cents" | "fair_use";
        fallback: "cached_content";
        paywall_trigger?: string | null;
      };
    }
  | {
      type?: "paywall.requested";
      payload?: {
        trigger: "hearts_empty" | "ai_minutes_exhausted" | "pro_feature" | "streak_at_risk" | "onboarding_plan";
      };
    }
  | {
      type?: "membership.changed";
      payload?: {
        tier: "free" | "pro";
        status: string;
      };
    }
);
/**
 * Uebungen sind Daten. Das Frontend rendert sie ueber eine Renderer-Registry pro `type`.
 */
export interface Exercise {
  schema_version: "1.0.0";
  id: string;
  type:
    | "multiple_choice"
    | "matching"
    | "fill_blank"
    | "listen_pick"
    | "speak_repeat"
    | "word_order"
    | "roleplay"
    | "flashcard";
  language: string;
  item_id: string;
  skill: "listening" | "speaking" | "vocabulary" | "grammar";
  level?: "A1" | "A2" | "B1" | "B2";
  /**
   * true: richtig/falsch entscheidbar, Fehler kosten Herzen. false: nie Herzverlust.
   */
  decidable: boolean;
  prompt: {
    say: string;
    translation?: string | null;
    audio_url?: string | null;
    hint?: string | null;
  };
  content: {
    /**
     * @maxItems 8
     */
    options?: string[];
    /**
     * @maxItems 8
     */
    pairs?: {
      left: string;
      right: string;
    }[];
    /**
     * @maxItems 12
     */
    tokens?: string[];
    sentence_with_blank?: string;
    scenario?: string;
    target_text?: string;
  };
  /**
   * Wird NICHT an das Frontend gesendet (Auswertung im Backend). Nur in internen Speichermodellen.
   */
  expected_answer?: string | unknown[] | null;
  source?: "curriculum" | "llm" | "mock";
  pack_status?: "draft" | "reviewed" | "published";
}
/**
 * Einzige erlaubte Ausgabe des LLM. Alles andere wird verworfen.
 */
export interface LLMTurn {
  say: string;
  exercise_type:
    | "multiple_choice"
    | "matching"
    | "fill_blank"
    | "listen_pick"
    | "speak_repeat"
    | "word_order"
    | "roleplay"
    | "flashcard"
    | "none";
  /**
   * @maxItems 8
   */
  options?: string[];
  expected_answer: string | unknown[] | null;
  hint?: string | null;
}
