// Fixed, shared prompts per weekday -- same content for every company, per
// the brief ("no content needs updating once built"). Monday's 3 goals are
// captured separately (see themed_checkins.goals in the migration) since
// they're read back structurally on Friday, not just displayed as text.
// Wednesday (Workout Wednesday) isn't here -- it's a structurally different
// screen (exercise bank + tier picker), handled by WorkoutWednesdayForm.

export type PromptField = {
  key: string;
  label: string;
  // "scale" renders a 1-10 rating row (the same control the Morning/Night
  // routines use). Its value is stored as a string in the answers jsonb, so
  // the server action needs no special handling -- it validates every field
  // as an optional string regardless of type.
  type: "textarea" | "text" | "scale";
};

export type TextCheckinWeekday = "monday" | "tuesday" | "thursday" | "friday";

export type FridayGoalStatus = "yes" | "partially" | "no";

export const FRIDAY_GOAL_OPTIONS: { value: FridayGoalStatus; label: string }[] = [
  { value: "yes", label: "Yes I achieved them" },
  { value: "partially", label: "Partially, I'm making progress" },
  { value: "no", label: "No I didn't achieve them" },
];

export const CHECKIN_CONFIG: Record<
  TextCheckinWeekday,
  { title: string; subtitle: string; fields: PromptField[] }
> = {
  monday: {
    title: "Momentum Monday",
    subtitle: "Set the week's direction",
    fields: [
      { key: "action_plan", label: "How am I going to take action on these?", type: "textarea" },
      { key: "start_right", label: "What can I do to start the week off right?", type: "textarea" },
      { key: "feeling_score", label: "How are you feeling? (1 = struggling, 10 = flying)", type: "scale" },
      {
        key: "score_up",
        label: "How can I get that score up by the end of the week?",
        type: "textarea",
      },
      { key: "promise", label: "A promise I'm making myself this week:", type: "textarea" },
      { key: "excited_for", label: "What am I excited for this week?", type: "textarea" },
    ],
  },
  tuesday: {
    title: "Talking Tuesday",
    subtitle: "Strengthen connection",
    fields: [
      {
        key: "reach_out",
        label: "Who have I not spoken to in a while that I should reach out to?",
        type: "textarea",
      },
      { key: "shout_out", label: "Who deserves a shout-out or a thank you?", type: "textarea" },
      {
        key: "conversation_needed",
        label: "Is there any conversation I need to have with someone?",
        type: "textarea",
      },
      {
        key: "who_can_help",
        label: "Is there anyone who can help me, or who I need to follow up with?",
        type: "textarea",
      },
      {
        key: "told_someone_loved",
        label: "Tell at least one friend or family member you love them. Who did you tell?",
        type: "text",
      },
      {
        key: "hard_thing_today",
        label: "What's one hard thing I can do today that I will benefit from?",
        type: "textarea",
      },
    ],
  },
  thursday: {
    title: "Thursday Thoughts",
    subtitle: "Pause, reflect and learn",
    fields: [
      { key: "week_going", label: "How is this week going?", type: "textarea" },
      { key: "gone_well", label: "What has gone well this week?", type: "textarea" },
      { key: "emotions_felt", label: "What emotions have I felt most this week?", type: "textarea" },
      { key: "week_taught", label: "What did this week teach me?", type: "textarea" },
      { key: "whats_helped", label: "What has helped me this week?", type: "textarea" },
      { key: "todays_win", label: "What would make today a win?", type: "textarea" },
      { key: "proud_of_yesterday", label: "What did I do yesterday that I'm proud of?", type: "textarea" },
      {
        key: "avoiding_thing",
        label:
          "What's one thing I've been avoiding that I know would make my life better if I finally got it done?",
        type: "textarea",
      },
    ],
  },
  friday: {
    title: "Feel Good Friday",
    subtitle: "Close the loop",
    fields: [
      { key: "went_well", label: "What went well?", type: "textarea" },
      { key: "improve_next_week", label: "What can I do better next week?", type: "textarea" },
      { key: "three_wins", label: "What are my three big wins for the week?", type: "textarea" },
      { key: "most_proud", label: "What am I most proud of this week?", type: "textarea" },
      { key: "most_fun", label: "What is the most fun I've had this week?", type: "textarea" },
      { key: "weekend_plans", label: "What are my plans for the weekend?", type: "textarea" },
      { key: "feel_today", label: "How good do I feel today? (1 = flat, 10 = brilliant)", type: "scale" },
      { key: "kindness_act", label: "Random act of kindness -- what did I do today?", type: "textarea" },
      { key: "compliment_given", label: "Give someone a compliment -- who and what did I say?", type: "textarea" },
    ],
  },
};
