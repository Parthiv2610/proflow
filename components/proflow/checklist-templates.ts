export type ChecklistTemplate = {
  id: string
  name: string
  icon: string
  color: string
  category: string
  items: { title: string; subtasks?: string[]; priority?: "low" | "medium" | "high" }[]
}

export const CHECKLIST_CATEGORIES = [
  "Shopping",
  "Travel",
  "Home",
  "Work",
  "Events",
  "Health",
  "Finance",
  "Education",
  "DIY",
  "Party",
]

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  // ── Shopping ──────────────────────────────────────
  {
    id: "tpl-grocery",
    name: "Grocery List",
    icon: "🛒",
    color: "#34D399",
    category: "Shopping",
    items: [
      { title: "Fruits & Vegetables", subtasks: ["Bananas", "Apples", "Spinach", "Tomatoes", "Onions"] },
      { title: "Dairy & Eggs", subtasks: ["Milk", "Eggs", "Butter", "Cheese", "Yogurt"] },
      { title: "Protein", subtasks: ["Chicken breast", "Ground beef", "Tofu"] },
      { title: "Pantry Staples", subtasks: ["Rice", "Pasta", "Olive oil", "Salt", "Pepper"] },
      { title: "Snacks", subtasks: ["Chips", "Nuts", "Granola bars"] },
      { title: "Drinks", subtasks: ["Water", "Coffee", "Juice"] },
    ],
  },
  {
    id: "tpl-office-supplies",
    name: "Office Supplies",
    icon: "📎",
    color: "#60A5FA",
    category: "Shopping",
    items: [
      { title: "Pens & Pencils" },
      { title: "Notebooks" },
      { title: "Sticky notes" },
      { title: "Printer paper" },
      { title: "Binder clips" },
      { title: "Stapler & staples" },
    ],
  },
  {
    id: "tpl-hardware",
    name: "Hardware Store",
    icon: "🔧",
    color: "#F59E0B",
    category: "Shopping",
    items: [
      { title: "Batteries (AA/AAA)" },
      { title: "Duct tape" },
      { title: "Light bulbs" },
      { title: "Screws & nails" },
      { title: "Extension cord" },
    ],
  },

  // ── Travel ──────────────────────────────────────
  {
    id: "tpl-travel-essentials",
    name: "Travel Essentials",
    icon: "✈️",
    color: "#8B5CF6",
    category: "Travel",
    items: [
      { title: "Documents", subtasks: ["Passport", "ID / Driver's license", "Boarding pass", "Hotel confirmation", "Travel insurance"] },
      { title: "Clothing", subtasks: ["T-shirts", "Pants / shorts", "Underwear", "Socks", "Jacket", "Sleepwear", "Swimsuit"] },
      { title: "Toiletries", subtasks: ["Toothbrush & paste", "Shampoo & conditioner", "Deodorant", "Sunscreen", "Medications"] },
      { title: "Electronics", subtasks: ["Phone charger", "Power bank", "Headphones", "Adapter / converter", "Camera"] },
      { title: "Comfort", subtasks: ["Neck pillow", "Eye mask", "Snacks", "Water bottle", "Book / e-reader"] },
    ],
  },
  {
    id: "tpl-camping",
    name: "Camping Trip",
    icon: "⛺",
    color: "#10B981",
    category: "Travel",
    items: [
      { title: "Shelter", subtasks: ["Tent", "Tarp / ground sheet", "Stakes & guylines"] },
      { title: "Sleeping", subtasks: ["Sleeping bag", "Sleeping pad", "Pillow"] },
      { title: "Cooking", subtasks: ["Stove & fuel", "Pots & pans", "Utensils", "Cooler & ice", "Water filter"] },
      { title: "Clothing", subtasks: ["Layers", "Rain gear", "Hiking boots", "Socks (extra)"] },
      { title: "Safety", subtasks: ["First aid kit", "Flashlight / headlamp", "Fire starter", "Map & compass"] },
    ],
  },
  {
    id: "tpl-road-trip",
    name: "Road Trip",
    icon: "🚗",
    color: "#EF4444",
    category: "Travel",
    items: [
      { title: "Car prep", subtasks: ["Check oil", "Check tires", "Fill gas", "Clean windshield"] },
      { title: "Entertainment", subtasks: ["Playlist / podcasts", "Games for passengers", "Audiobooks"] },
      { title: "Snacks & drinks", subtasks: ["Water bottles", "Chips", "Fruit", "Sandwiches"] },
      { title: "Navigation", subtasks: ["Download offline maps", "Save hotel addresses", "Check traffic"] },
      { title: "Emergency", subtasks: ["Spare tire & jack", "Jumper cables", "First aid kit", "Flashlight"] },
    ],
  },

  // ── Home ──────────────────────────────────────
  {
    id: "tpl-deep-clean",
    name: "Deep Clean",
    icon: "🧹",
    color: "#06B6D4",
    category: "Home",
    items: [
      { title: "Kitchen", subtasks: ["Clean oven", "Degrease stovetop", "Clean fridge (inside & out)", "Descale kettle", "Mop floor"] },
      { title: "Bathroom", subtasks: ["Scrub tiles & grout", "Clean toilet", "Replace shower curtain", "Clean mirrors", "Organize cabinets"] },
      { title: "Living areas", subtasks: ["Dust all surfaces", "Vacuum upholstery", "Wash curtains", "Clean windows", "Organize bookshelf"] },
      { title: "Bedroom", subtasks: ["Wash bedding", "Flip / rotate mattress", "Clean under bed", "Organize closet"] },
      { title: "General", subtasks: ["Replace HVAC filter", "Test smoke detectors", "Wipe light switches", "Clean baseboards"] },
    ],
  },
  {
    id: "tpl-moving",
    name: "Moving Checklist",
    icon: "📦",
    color: "#F97316",
    category: "Home",
    items: [
      { title: "2 weeks before", subtasks: ["Notify landlord", "Arrange moving truck", "Collect packing supplies", "Start decluttering"] },
      { title: "1 week before", subtasks: ["Pack non-essentials", "Change address (USPS)", "Transfer utilities", "Defrost freezer"] },
      { title: "Moving day", subtasks: ["Do final walk-through", "Load truck (heavy items first)", "Take photos of empty rooms", "Return keys"] },
      { title: "At new place", subtasks: ["Check utilities work", "Change locks", "Unpack kitchen first", "Set up beds", "Update driver's license"] },
    ],
  },
  {
    id: "tpl-maintenance",
    name: "Home Maintenance",
    icon: "🏠",
    color: "#A78BFA",
    category: "Home",
    items: [
      { title: "Monthly", subtasks: ["Test smoke detectors", "Check fire extinguishers", "Clean HVAC filter", "Check faucets for leaks"] },
      { title: "Quarterly", subtasks: ["Clean gutters", "Check water heater", "Inspect roof", "Service lawn mower"] },
      { title: "Annually", subtasks: ["Flush water heater", "Check insulation", "Paint touch-ups", "Deep clean dryer vent"] },
    ],
  },

  // ── Work ──────────────────────────────────────
  {
    id: "tpl-project",
    name: "Project Launch",
    icon: "🚀",
    color: "#3B82F6",
    category: "Work",
    items: [
      { title: "Planning", subtasks: ["Define scope & goals", "Set timeline", "Identify stakeholders", "Create budget", "Risk assessment"] },
      { title: "Prep", subtasks: ["Set up tools & repos", "Create doc templates", "Schedule kick-off meeting", "Assign roles"] },
      { title: "Execution", subtasks: ["Daily standups", "Sprint planning", "Code reviews", "Progress tracking"] },
      { title: "Launch", subtasks: ["QA testing", "Staging deploy", "Final review", "Production deploy", "Post-launch monitoring"] },
    ],
  },
  {
    id: "tpl-meeting",
    name: "Meeting Prep",
    icon: "📋",
    color: "#14B8A6",
    category: "Work",
    items: [
      { title: "Before", subtasks: ["Set agenda", "Send calendar invites", "Prepare materials", "Share pre-reads"] },
      { title: "During", subtasks: ["Take notes", "Track action items", "Keep time", "Assign owners"] },
      { title: "After", subtasks: ["Send meeting notes", "Follow up on action items", "Update project tracker"] },
    ],
  },
  {
    id: "tpl-onboarding",
    name: "New Hire Onboarding",
    icon: "👋",
    color: "#EC4899",
    category: "Work",
    items: [
      { title: "Before day 1", subtasks: ["Set up accounts", "Prepare workstation", "Schedule team intros", "Send welcome email"] },
      { title: "First week", subtasks: ["Orientation sessions", "Tool training", "Assign buddy", "1:1 with manager"] },
      { title: "First month", subtasks: ["30-day review", "Set 90-day goals", "Feedback session", "Team lunch"] },
    ],
  },

  // ── Events ──────────────────────────────────────
  {
    id: "tpl-party",
    name: "Party Planning",
    icon: "🎉",
    color: "#F472B6",
    category: "Events",
    items: [
      { title: "Planning", subtasks: ["Set date & time", "Choose venue", "Make guest list", "Set budget"] },
      { title: "Supplies", subtasks: ["Invitations", "Decorations", "Tableware", "Party favors"] },
      { title: "Food & drinks", subtasks: ["Plan menu", "Buy ingredients", "Order cake", "Stock drinks"] },
      { title: "Day of", subtasks: ["Set up decorations", "Prepare food", "Set up music", "Clean up after"] },
    ],
  },
  {
    id: "tpl-wedding",
    name: "Wedding Planning",
    icon: "💒",
    color: "#FB923C",
    category: "Events",
    items: [
      { title: "12+ months out", subtasks: ["Set budget", "Choose date", "Book venue", "Hire planner"] },
      { title: "6-9 months", subtasks: ["Choose wedding party", "Book photographer", "Order invitations", "Book DJ/band"] },
      { title: "3-6 months", subtasks: ["Book caterer", "Buy dress/suit", "Plan honeymoon", "Book officiant"] },
      { title: "1 month", subtasks: ["Final RSVP count", "Confirm vendors", "Write vows", "Get marriage license"] },
      { title: "Week of", subtasks: ["Confirm timeline", "Pack for honeymoon", "Rehearsal dinner", "Prepare tips for vendors"] },
    ],
  },
  {
    id: "tpl-birthday",
    name: "Birthday Party",
    icon: "🎂",
    color: "#A855F7",
    category: "Events",
    items: [
      { title: "Plan", subtasks: ["Choose theme", "Set budget", "Pick venue / location", "Make guest list"] },
      { title: "Order", subtasks: ["Cake", "Decorations", "Party hats & supplies", "Gift for birthday person"] },
      { title: "Day before", subtasks: ["Confirm RSVPs", "Prep food", "Set up decorations", "Charge camera"] },
      { title: "Party day", subtasks: ["Final setup", "Serve food", "Take photos", "Clean up"] },
    ],
  },

  // ── Health ──────────────────────────────────────
  {
    id: "tpl-morning-routine",
    name: "Morning Routine",
    icon: "🌅",
    color: "#FBBF24",
    category: "Health",
    items: [
      { title: "Wake up", subtasks: ["Drink water", "Stretch (5 min)", "Make bed"] },
      { title: "Body care", subtasks: ["Shower", "Skincare", "Brush teeth"] },
      { title: "Mind", subtasks: ["Meditate (10 min)", "Journal", "Set top 3 priorities"] },
      { title: "Fuel", subtasks: ["Healthy breakfast", "Take vitamins", "Pack lunch"] },
    ],
  },
  {
    id: "tpl-workout",
    name: "Gym Workout",
    icon: "💪",
    color: "#EF4444",
    category: "Health",
    items: [
      { title: "Warm-up", subtasks: ["5 min cardio", "Dynamic stretches", "Foam roll"] },
      { title: "Strength", subtasks: ["Compound lifts", "Accessory work", "Core exercises"] },
      { title: "Cardio", subtasks: ["Run / bike / row", "15-20 min steady state"] },
      { title: "Cool-down", subtasks: ["Static stretches", "Hydrate", "Log workout"] },
    ],
  },

  // ── Finance ──────────────────────────────────────
  {
    id: "tpl-tax-prep",
    name: "Tax Preparation",
    icon: "💰",
    color: "#22C55E",
    category: "Finance",
    items: [
      { title: "Gather documents", subtasks: ["W-2 / 1099 forms", "Receipts (business)", "Mortgage interest statement", "Charitable donations"] },
      { title: "Deductions", subtasks: ["Home office expenses", "Medical expenses", "Education costs", "Business travel"] },
      { title: "File", subtasks: ["Choose filing method", "Double-check numbers", "E-file or mail", "Save copy for records"] },
    ],
  },

  // ── Education ──────────────────────────────────────
  {
    id: "tpl-study-session",
    name: "Study Session",
    icon: "📚",
    color: "#6366F1",
    category: "Education",
    items: [
      { title: "Prep", subtasks: ["Gather materials", "Find quiet space", "Set timer (Pomodoro)", "Silence phone"] },
      { title: "Active study", subtasks: ["Read / highlight notes", "Make flashcards", "Practice problems", "Teach it back"] },
      { title: "Review", subtasks: ["Summarize key points", "Quiz yourself", "Identify weak areas", "Plan next session"] },
    ],
  },
  {
    id: "tpl-online-course",
    name: "Online Course Completion",
    icon: "🎓",
    color: "#0EA5E9",
    category: "Education",
    items: [
      { title: "Setup", subtasks: ["Enroll in course", "Set study schedule", "Download materials", "Join community"] },
      { title: "During", subtasks: ["Watch lectures", "Complete assignments", "Participate in forums", "Take practice tests"] },
      { title: "Completion", subtasks: ["Finish final project", "Take final exam", "Get certificate", "Apply learnings"] },
    ],
  },

  // ── DIY ──────────────────────────────────────
  {
    id: "tpl-home-renovation",
    name: "Home Renovation",
    icon: "🔨",
    color: "#D97706",
    category: "DIY",
    items: [
      { title: "Planning", subtasks: ["Set budget", "Get inspiration", "Measure space", "Research contractors"] },
      { title: "Materials", subtasks: ["Buy supplies", "Rent tools", "Order fixtures", "Get permits"] },
      { title: "Execution", subtasks: ["Demo (if needed)", "Rough-in (electrical/plumbing)", "Install flooring", "Paint", "Finish work"] },
      { title: "Final", subtasks: ["Clean up", "Inspect work", "Make punch list", "Final touches"] },
    ],
  },

  // ── Blank ──────────────────────────────────────
  {
    id: "tpl-blank",
    name: "Blank Checklist",
    icon: "📝",
    color: "#9CA3AF",
    category: "Custom",
    items: [],
  },
]
