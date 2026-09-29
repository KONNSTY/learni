// AUTO-GENERIERT aus packages/contracts (npm run gen). Nicht von Hand aendern.
export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Health"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Remote Config (Preise, Limits, Feature-Flags) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/languages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sprachen inkl. Tier */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Language"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Legt Profil/Mitgliedschaft nach Login an (idempotent) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AuthSyncRequest"];
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserState"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Profil lesen */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Profile"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Profil/Einstellungen aendern */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ProfilePatch"];
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Profile"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/onboarding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Onboarding speichern (Level, Ziel, Tagesziel) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["OnboardingRequest"];
                };
            };
            responses: {
                /** @description Lernplan */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningPlan"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Aktueller Lernstand, Herzen, Streak, Budget */
        get: {
            parameters: {
                query: {
                    language: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserState"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lernplan */
        get: {
            parameters: {
                query: {
                    language: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningPlan"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/exercises/next": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Orchestrator waehlt naechste Uebung (deterministisch) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NextExerciseRequest"];
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NextExerciseResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/exercises/{exercise_id}/answer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Antwort auswerten */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    exercise_id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AnswerRequest"];
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AnswerResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/lessons/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Lektion abschliessen (XP, Streak, Tagesziel) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["LessonCompleteRequest"];
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventsResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/voice/turn": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ein Sprach-Turn (STT, LLM, TTS). Audio wird nie gespeichert. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["VoiceTurnRequest"];
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["VoiceTurnResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ads/rewarded": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Freiwillige Rewarded Ad wurde angesehen -> 1 Herz */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventsResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/tutor-profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** KI-Nutzerprofil einsehen */
        get: {
            parameters: {
                query: {
                    language: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TutorProfile"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** KI-Nutzerprofil loeschen */
        delete: {
            parameters: {
                query: {
                    language: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description geloescht */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Datenexport (DSGVO Art. 20) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/account": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Konto vollstaendig loeschen (inkl. Lernermodell und KI-Profil) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description geloescht */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/analytics/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** KPI-Events */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AnalyticsEvent"];
                };
            };
            responses: {
                /** @description angenommen */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/revenuecat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** RevenueCat-Webhook (Signaturpruefung per Authorization-Header) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description ungueltige Signatur */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/dev/membership": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** NUR APP_ENV=dev - Mock-Sandbox schaltet Free/Pro */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {unknown} */
                        tier: "free" | "pro";
                    };
                };
            };
            responses: {
                /** @description ok */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserState"];
                    };
                };
                /** @description nicht in Produktion */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Health: {
            status: string;
            mock_providers: string[];
            version?: string;
        };
        Language: {
            code: string;
            name: string;
            native_name: string;
            /** @enum {unknown} */
            tier: "A" | "B" | "C";
            /** @description Kuerzel fuer Icon, keine Flagge */
            badge: string;
            region_variants?: string[];
        };
        AuthSyncRequest: {
            native_language?: string;
            /** @enum {unknown} */
            ui_language?: "de" | "en";
            display_name?: string;
            /** @description ISO-Land des Geraets (Geo-Tiering der Kostenlimits) */
            region?: string;
        };
        ProfilePatch: {
            display_name?: string;
            native_language?: string;
            /** @enum {unknown} */
            ui_language?: "de" | "en";
            /** @enum {unknown} */
            age_bracket?: "under_16" | "16_17" | "18_plus";
            settings?: components["schemas"]["Settings"];
            consents?: components["schemas"]["Consents"];
        };
        Settings: {
            avatar_voice?: boolean;
            sfx?: boolean;
            haptics?: boolean;
            show_translation?: boolean;
            auto_vad?: boolean;
        };
        Consents: {
            voice_processing?: boolean;
            personalized_ads?: boolean;
            analytics?: boolean;
        };
        Profile: {
            user_id: string;
            display_name?: string | null;
            native_language: string;
            ui_language: string;
            age_bracket?: string | null;
            avatar?: {
                [key: string]: unknown;
            };
            settings: components["schemas"]["Settings"];
            consents: components["schemas"]["Consents"];
        };
        Membership: {
            /** @enum {unknown} */
            tier: "free" | "pro";
            status: string;
            trial?: boolean;
            expires_at?: string | null;
            source?: string;
            regional_tier?: string;
        };
        BudgetState: {
            ai_seconds_used: number;
            ai_seconds_limit: number;
            cost_cents_used: number;
            cost_cents_limit: number;
            limited: boolean;
        };
        UserState: {
            profile: components["schemas"]["Profile"];
            membership: components["schemas"]["Membership"];
            learning: components["schemas"]["LearningState"];
            budget?: components["schemas"]["BudgetState"];
        };
        LearningState: {
            language?: string;
            /** @enum {unknown} */
            level?: "A1" | "A2" | "B1" | "B2";
            goal?: string;
            daily_goal_minutes?: number;
            daily_xp?: number;
            daily_xp_target?: number;
            xp?: number;
            streak_days?: number;
            streak_freezes?: number;
            hearts?: number;
            max_hearts?: number | null;
            unlimited_hearts?: boolean;
            trophies?: string[];
            skills?: {
                [key: string]: number;
            };
        };
        OnboardingRequest: {
            language: string;
            /** @enum {unknown} */
            self_level: "none" | "few_words" | "simple_conversations" | "everyday";
            adaptive_answers?: {
                item_id: string;
                correct: boolean;
            }[];
            /** @enum {unknown} */
            goal: "travel" | "work" | "family" | "fun";
            /** @enum {unknown} */
            daily_goal_minutes: 5 | 10 | 15 | 20;
        };
        LearningPlan: {
            language: string;
            level: string;
            weeks_to_next_level: number;
            daily_goal_minutes: number;
            topics: string[];
            /** @constant */
            paywall_trigger: "onboarding_plan";
        };
        NextExerciseRequest: {
            language: string;
            /** @enum {unknown} */
            mode?: "curriculum" | "conversation";
        };
        NextExerciseResponse: {
            exercise: components["schemas"]["exercise.schema"];
            events: components["schemas"]["events.schema"][];
            test_mode?: boolean;
        };
        AnswerRequest: {
            language: string;
            answer: string | string[];
            response_ms?: number;
            pronunciation_score?: number;
        };
        AnswerResponse: {
            events: components["schemas"]["events.schema"][];
        };
        EventsResponse: {
            events: components["schemas"]["events.schema"][];
        };
        LessonCompleteRequest: {
            language: string;
            xp: number;
            mistakes: number;
            minutes: number;
        };
        VoiceTurnRequest: {
            /** @description Lernsprache = STT-Sprach-Hint */
            language: string;
            /** @description PCM/WAV, nur im Speicher verarbeitet, nie persistiert */
            audio_b64?: string;
            audio_seconds?: number;
            /**
             * @default audio/wav
             * @enum {unknown}
             */
            audio_mime: "audio/wav" | "audio/mp4" | "audio/mpeg" | "audio/webm" | "audio/ogg";
            /** @description Fallback ohne Audio */
            text?: string;
            slow?: boolean;
            exercise_id?: string;
        };
        VoiceTurnResponse: {
            transcript: string;
            events: components["schemas"]["events.schema"][];
            latency_ms: {
                [key: string]: number;
            };
            test_mode?: boolean;
        };
        TutorProfile: {
            language?: string;
            goals?: string[];
            interests?: string[];
            typical_mistakes?: string[];
            pace?: string;
            preferences?: {
                [key: string]: unknown;
            };
            updated_at?: string;
        };
        AnalyticsEvent: {
            /** @enum {unknown} */
            name: "app_open" | "trial_start" | "trial_converted" | "purchase" | "ad_impression" | "lesson_complete" | "voice_turn" | "error" | "paywall_shown";
            language?: string;
            props?: {
                [key: string]: unknown;
            };
        };
        /**
         * Exercise
         * @description Uebungen sind Daten. Das Frontend rendert sie ueber eine Renderer-Registry pro `type`.
         */
        "exercise.schema": {
            /** @constant */
            schema_version: "1.0.0";
            id: string;
            /** @enum {unknown} */
            type: "multiple_choice" | "matching" | "fill_blank" | "listen_pick" | "speak_repeat" | "word_order" | "roleplay" | "flashcard";
            language: string;
            item_id: string;
            /** @enum {unknown} */
            skill: "listening" | "speaking" | "vocabulary" | "grammar";
            /** @enum {unknown} */
            level?: "A1" | "A2" | "B1" | "B2";
            /** @description true: richtig/falsch entscheidbar, Fehler kosten Herzen. false: nie Herzverlust. */
            decidable: boolean;
            prompt: {
                say: string;
                translation?: string | null;
                audio_url?: string | null;
                hint?: string | null;
            };
            content: {
                options?: string[];
                pairs?: {
                    left: string;
                    right: string;
                }[];
                tokens?: string[];
                sentence_with_blank?: string;
                scenario?: string;
                target_text?: string;
            };
            /** @description Wird NICHT an das Frontend gesendet (Auswertung im Backend). Nur in internen Speichermodellen. */
            expected_answer?: string | unknown[] | null;
            /** @enum {unknown} */
            source?: "curriculum" | "llm" | "mock";
            /** @enum {unknown} */
            pack_status?: "draft" | "reviewed" | "published";
        };
        /**
         * LearniEvent
         * @description Semantische Events Backend -> Frontend. Keine UI-Anweisungen. Aussehen, Klang und Haptik entscheidet das Frontend.
         */
        "events.schema": {
            /** @constant */
            event_version: "1.0.0";
            type: string;
            ts: string;
            payload: Record<string, never>;
        } & ({
            /** @constant */
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
        } | {
            /** @constant */
            type?: "reward.granted";
            payload?: {
                /** @enum {unknown} */
                kind: "xp" | "heart" | "streak_freeze" | "trophy";
                amount: number;
                reason?: string;
                trophy_id?: string;
            };
        } | {
            /** @constant */
            type?: "hearts.changed";
            payload?: {
                hearts: number;
                max_hearts: number | null;
                unlimited?: boolean;
            };
        } | {
            /** @constant */
            type?: "hearts.empty";
            payload?: {
                /** @constant */
                paywall_trigger?: "hearts_empty";
            };
        } | {
            /** @constant */
            type?: "streak.updated";
            payload?: {
                days: number;
                freeze_used: boolean;
                at_risk?: boolean;
            };
        } | {
            /** @constant */
            type?: "level.up";
            payload?: {
                language: string;
                level: string;
                skill?: string;
            };
        } | {
            /** @constant */
            type?: "daily_goal.reached";
            payload?: {
                xp: number;
            };
        } | {
            /** @constant */
            type?: "lesson.completed";
            payload?: {
                xp_gained: number;
                mistakes: number;
                minutes: number;
            };
        } | {
            /** @constant */
            type?: "avatar.speak";
            payload?: {
                text: string;
                audio_url: string | null;
                visemes: {
                    t_ms: number;
                    viseme: number;
                }[];
                /** @enum {unknown} */
                emotion: "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate";
                mock?: boolean;
            };
        } | {
            /** @constant */
            type?: "budget.limited";
            payload?: {
                /** @enum {unknown} */
                reason: "ai_minutes" | "cost_cents" | "fair_use";
                /** @constant */
                fallback: "cached_content";
                paywall_trigger?: string | null;
            };
        } | {
            /** @constant */
            type?: "paywall.requested";
            payload?: {
                /** @enum {unknown} */
                trigger: "hearts_empty" | "ai_minutes_exhausted" | "pro_feature" | "streak_at_risk" | "onboarding_plan";
            };
        } | {
            /** @constant */
            type?: "membership.changed";
            payload?: {
                /** @enum {unknown} */
                tier: "free" | "pro";
                status: string;
            };
        });
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
