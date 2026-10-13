import { describe, it, expect } from "vitest";
import {
  toMorningInitial,
  toNightInitial,
  toWeeklyReviewInitial,
  toSundaySetupInitial,
  toThemedInitial,
} from "./checkinPrefill";

describe("checkin prefill mappers (E2 -- surface the saved row so a re-submit can't wipe it)", () => {
  describe("toMorningInitial", () => {
    it("returns empty defaults for a fresh day (null row)", () => {
      expect(toMorningInitial(null)).toEqual({
        sleepScore: null,
        morningWalk: false,
        breathwork: false,
        coldDip: false,
        powerList: "",
      });
    });

    it("surfaces every saved field so the form re-sends it", () => {
      expect(
        toMorningInitial({
          sleep_score: 7,
          morning_walk: true,
          breathwork: false,
          cold_dip: true,
          power_list: "ship E2",
          // unrelated columns are ignored
          completed_at: "2026-10-13T06:00:00Z",
        })
      ).toEqual({
        sleepScore: 7,
        morningWalk: true,
        breathwork: false,
        coldDip: true,
        powerList: "ship E2",
      });
    });

    it("degrades to defaults for missing or wrong-typed columns", () => {
      expect(toMorningInitial({ sleep_score: "7", power_list: null })).toEqual({
        sleepScore: null,
        morningWalk: false,
        breathwork: false,
        coldDip: false,
        powerList: "",
      });
    });
  });

  describe("toNightInitial", () => {
    it("returns empty defaults for a null row", () => {
      expect(toNightInitial(null)).toEqual({
        noPhoneBeforeBed: false,
        hotBathOrShower: false,
        gratitude: "",
        highlight: "",
        dayRating: null,
        lookingAhead: "",
      });
    });

    it("surfaces saved booleans, text and rating", () => {
      expect(
        toNightInitial({
          no_phone_before_bed: true,
          hot_bath_or_shower: false,
          gratitude: "my team",
          highlight: "shipped",
          day_rating: 9,
          looking_ahead: "rest",
        })
      ).toEqual({
        noPhoneBeforeBed: true,
        hotBathOrShower: false,
        gratitude: "my team",
        highlight: "shipped",
        dayRating: 9,
        lookingAhead: "rest",
      });
    });
  });

  describe("toWeeklyReviewInitial / toSundaySetupInitial", () => {
    it("map the weekly review text columns, blank for a null row", () => {
      expect(toWeeklyReviewInitial(null)).toEqual({
        habitsServedWell: "",
        challengesHelpedGrow: "",
        lessonsLearned: "",
        challengesOvercome: "",
        feelsBetterFromHabits: "",
        oneThingToImprove: "",
        habitsToDoubleDown: "",
      });
      expect(
        toWeeklyReviewInitial({
          habits_served_well: "sleep",
          one_thing_to_improve: "focus",
        })
      ).toMatchObject({ habitsServedWell: "sleep", oneThingToImprove: "focus", lessonsLearned: "" });
    });

    it("maps the sunday setup columns", () => {
      expect(toSundaySetupInitial(null)).toEqual({ prepNotes: "", intention: "" });
      expect(toSundaySetupInitial({ prep_notes: "kit ready", intention: "calm" })).toEqual({
        prepNotes: "kit ready",
        intention: "calm",
      });
    });
  });

  describe("toThemedInitial", () => {
    it("returns empty answers + goals for a null row", () => {
      expect(toThemedInitial(null)).toEqual({ answers: {}, goals: [] });
    });

    it("keeps every saved string answer (so none is dropped on re-submit) and ignores non-strings", () => {
      expect(
        toThemedInitial({
          answers: { went_well: "lots", three_wins: "a, b, c", feel_today: "8", bogus: 42, nested: {} },
          goals: null,
        })
      ).toEqual({
        answers: { went_well: "lots", three_wins: "a, b, c", feel_today: "8" },
        goals: [],
      });
    });

    it("extracts Monday goals from the { goals: [...] } jsonb, filtering non-strings", () => {
      expect(toThemedInitial({ answers: {}, goals: { goals: ["lift", "", 3, "read"] } })).toEqual({
        answers: {},
        goals: ["lift", "", "read"],
      });
    });

    it("tolerates a malformed goals shape", () => {
      expect(toThemedInitial({ answers: {}, goals: ["not", "wrapped"] })).toEqual({ answers: {}, goals: [] });
    });
  });
});
