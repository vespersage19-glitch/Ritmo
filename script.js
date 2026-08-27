/* =========================================================
   RITMO — PHASE 3
   STABLE BUTTON FIX
   ========================================================= */

const STORAGE_KEY = "ritmo-v3-data";
const BACKUP_KEY = "ritmo-v3-backup";
const LEGACY_KEY = "ritmo-habits";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PROGRESS_RADIUS = 43;
const PROGRESS_CIRCUMFERENCE =
  2 * Math.PI * PROGRESS_RADIUS;

let data = null;
let viewedWeekStart = null;
let deleteUndoTimer = null;

/* =========================================================
   DOM
   ========================================================= */

let habitInput;
let addHabitBtn;
let habitMatrix;
let emptyState;

let progressPercent;
let progressRing;

let completedCount;
let totalHabits;
let bestStreak;

let weekLabel;
let dateElement;

let previousWeekBtn;
let nextWeekBtn;
let todayBtn;

let historyBtn;
let historyPanel;
let historyCloseBtn;
let historyList;

let historyTotalHabits;
let historyBestStreak;
let historyTotalCompletions;

/* =========================================================
   INIT
   ========================================================= */

function initRitmo() {
  cacheElements();

  data = loadData();

  viewedWeekStart = startOfWeek(new Date());

  setupEvents();

  render();
}

/* =========================================================
   CACHE ELEMENTS
   ========================================================= */

function cacheElements() {
  habitInput = document.getElementById("habitInput");
  addHabitBtn = document.getElementById("addHabitBtn");

  habitMatrix = document.getElementById("habitMatrix");
  emptyState = document.getElementById("emptyState");

  progressPercent =
    document.getElementById("progressPercent");

  progressRing =
    document.getElementById("progressRing");

  completedCount =
    document.getElementById("completedCount");

  totalHabits =
    document.getElementById("totalHabits");

  bestStreak =
    document.getElementById("bestStreak");

  weekLabel =
    document.getElementById("weekLabel");

  dateElement =
    document.getElementById("date");

  previousWeekBtn =
    document.getElementById("previousWeekBtn");

  nextWeekBtn =
    document.getElementById("nextWeekBtn");

  todayBtn =
    document.getElementById("todayBtn");

  historyBtn =
    document.getElementById("historyBtn");

  historyPanel =
    document.getElementById("historyPanel");

  historyCloseBtn =
    document.getElementById("historyCloseBtn");

  historyList =
    document.getElementById("historyList");

  historyTotalHabits =
    document.getElementById("historyTotalHabits");

  historyBestStreak =
    document.getElementById("historyBestStreak");

  historyTotalCompletions =
    document.getElementById("historyTotalCompletions");
}

/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

  addHabitBtn.addEventListener("click", addHabit);

  habitInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      addHabit();
    }
  });

  previousWeekBtn.addEventListener(
    "click",
    goToPreviousWeek
  );

  nextWeekBtn.addEventListener(
    "click",
    goToNextWeek
  );

  todayBtn.addEventListener(
    "click",
    goToToday
  );

  historyBtn.addEventListener(
    "click",
    toggleHistory
  );

  historyCloseBtn.addEventListener(
    "click",
    closeHistory
  );

  /*
    IMPORTANT:
    One reliable click handler for the entire matrix.
    This handles dynamically-created buttons.
  */
  habitMatrix.addEventListener("click", event => {

    const dayButton =
      event.target.closest(".day-cell");

    if (dayButton) {

      if (dayButton.disabled) {
        return;
      }

      const habitId =
        dayButton.dataset.habitId;

      const dateKey =
        dayButton.dataset.date;

      if (!habitId || !dateKey) {
        return;
      }

      toggleCompletion(
        habitId,
        dateKey,
        dayButton
      );

      return;
    }

    const editButton =
      event.target.closest(".edit-button");

    if (editButton) {

      const habitId =
        editButton.dataset.habitId;

      if (habitId) {
        editHabit(habitId);
      }

      return;
    }

    const deleteButton =
      event.target.closest(".delete-button");

    if (deleteButton) {

      const habitId =
        deleteButton.dataset.habitId;

      if (habitId) {
        deleteHabit(habitId);
      }
    }
  });
}

/* =========================================================
   DATE HELPERS
   ========================================================= */

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDateKey(date = new Date()) {
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate())
  );
}

function parseDateKey(key) {

  const parts =
    key.split("-").map(Number);

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}

function startOfWeek(date) {

  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  result.setDate(
    result.getDate() - result.getDay()
  );

  return result;
}

function addDays(date, amount) {

  const result = new Date(date);

  result.setDate(
    result.getDate() + amount
  );

  return result;
}

function isSameDate(first, second) {

  return (
    getDateKey(first) ===
    getDateKey(second)
  );
}

function isFutureDate(date) {

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const target = new Date(date);

  target.setHours(0, 0, 0, 0);

  return target > today;
}

function formatDate(date) {

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short"
    }
  );
}

function formatWeekRange(start) {

  const end = addDays(start, 6);

  const startText =
    start.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short"
      }
    );

  const endText =
    end.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );

  return `${startText} – ${endText}`;
}

/* =========================================================
   DATA
   ========================================================= */

function createEmptyData() {

  return {
    version: 3,

    habits: [],

    stats: {
      bestStreak: 0
    }
  };
}

function createHabitId() {

  return (
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function normalizeCompletions(completions) {

  if (
    !completions ||
    typeof completions !== "object" ||
    Array.isArray(completions)
  ) {
    return {};
  }

  const result = {};

  Object.entries(completions).forEach(
    ([key, value]) => {

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        value === true
      ) {
        result[key] = true;
      }
    }
  );

  return result;
}

function normalizeData(raw) {

  const clean = createEmptyData();

  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    return clean;
  }

  if (Array.isArray(raw.habits)) {

    clean.habits =
      raw.habits
        .filter(
          habit =>
            habit &&
            typeof habit === "object" &&
            String(habit.name || "").trim()
        )
        .map(habit => ({

          id:
            String(
              habit.id ||
              createHabitId()
            ),

          name:
            String(
              habit.name || ""
            )
              .trim()
              .slice(0, 50),

          createdAt:
            typeof habit.createdAt === "string"
              ? habit.createdAt
              : new Date().toISOString(),

          completions:
            normalizeCompletions(
              habit.completions
            )
        }));
  }

  const savedBest =
    Number(
      raw.stats &&
      raw.stats.bestStreak
    );

  if (
    Number.isFinite(savedBest) &&
    savedBest >= 0
  ) {

    clean.stats.bestStreak =
      Math.floor(savedBest);
  }

  return clean;
}

/* =========================================================
   LEGACY MIGRATION
   ========================================================= */

function migrateLegacyData() {

  const result =
    createEmptyData();

  try {

    const raw =
      localStorage.getItem(
        LEGACY_KEY
      );

    if (!raw) {
      return result;
    }

    const legacy =
      JSON.parse(raw);

    if (!Array.isArray(legacy)) {
      return result;
    }

    legacy.forEach(
      (habit, index) => {

        if (
          !habit ||
          !String(
            habit.name || ""
          ).trim()
        ) {
          return;
        }

        const completions = {};

        if (
          habit.completed === true &&
          /^\d{4}-\d{2}-\d{2}$/.test(
            habit.lastCompletedDate || ""
          )
        ) {

          completions[
            habit.lastCompletedDate
          ] = true;
        }

        result.habits.push({

          id:
            String(
              habit.id ||
              `${Date.now()}-${index}`
            ),

          name:
            String(habit.name)
              .trim()
              .slice(0, 50),

          createdAt:
            new Date().toISOString(),

          completions
        });

        result.stats.bestStreak =
          Math.max(
            result.stats.bestStreak,
            Number(habit.bestStreak) || 0,
            Number(habit.streak) || 0
          );
      }
    );

  } catch (error) {

    console.error(
      "Ritmo migration error:",
      error
    );
  }

  return result;
}

/* =========================================================
   STORAGE
   ========================================================= */

function loadData() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (saved) {

      return normalizeData(
        JSON.parse(saved)
      );
    }

  } catch (error) {

    console.error(
      "Ritmo primary storage error:",
      error
    );

    try {

      const backup =
        localStorage.getItem(
          BACKUP_KEY
        );

      if (backup) {

        return normalizeData(
          JSON.parse(backup)
        );
      }

    } catch (backupError) {

      console.error(
        "Ritmo backup recovery error:",
        backupError
      );
    }
  }

  return migrateLegacyData();
}

function saveData() {

  try {

    const serialized =
      JSON.stringify(data);

    const previous =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (previous) {

      localStorage.setItem(
        BACKUP_KEY,
        previous
      );
    }

    localStorage.setItem(
      STORAGE_KEY,
      serialized
    );

    return true;

  } catch (error) {

    console.error(
      "Ritmo save error:",
      error
    );

    return false;
  }
}

/* =========================================================
   STREAK ENGINE
   ========================================================= */

function calculateBestStreak(habit) {

  const dates =
    Object.keys(
      habit.completions || {}
    )
      .filter(
        key =>
          habit.completions[key] === true
      )
      .sort();

  let best = 0;
  let current = 0;
  let previous = null;

  dates.forEach(key => {

    if (previous) {

      const difference =
        Math.round(
          (
            parseDateKey(key) -
            parseDateKey(previous)
          ) / 86400000
        );

      if (difference === 1) {
        current++;
      } else {
        current = 1;
      }

    } else {

      current = 1;
    }

    best =
      Math.max(
        best,
        current
      );

    previous = key;
  });

  return best;
}

function calculateCurrentStreak(habit) {

  const todayKey =
    getDateKey();

  if (
    habit.completions[todayKey] !== true
  ) {
    return 0;
  }

  let streak = 0;

  let cursor =
    new Date();

  while (
    habit.completions[
      getDateKey(cursor)
    ] === true
  ) {

    streak++;

    cursor =
      addDays(
        cursor,
        -1
      );
  }

  return streak;
}

function updatePermanentBestStreak() {

  let highest =
    Number(
      data.stats.bestStreak
    ) || 0;

  data.habits.forEach(
    habit => {

      highest =
        Math.max(
          highest,
          calculateBestStreak(habit)
        );
    }
  );

  data.stats.bestStreak =
    highest;
}

function countTotalCompletions(habit) {

  return Object.keys(
    habit.completions || {}
  )
    .filter(
      key =>
        habit.completions[key] === true
    )
    .length;
}

/* =========================================================
   ADD HABIT
   ========================================================= */

function addHabit() {

  const name =
    habitInput.value
      .trim()
      .slice(0, 50);

  if (!name) {

    habitInput.focus();

    return;
  }

  const exists =
    data.habits.some(
      habit =>
        habit.name.toLowerCase() ===
        name.toLowerCase()
    );

  if (exists) {

    window.alert(
      "This habit already exists."
    );

    habitInput.focus();
    habitInput.select();

    return;
  }

  data.habits.push({

    id: createHabitId(),

    name,

    createdAt:
      new Date().toISOString(),

    completions: {}
  });

  habitInput.value = "";

  updatePermanentBestStreak();

  saveData();

  render();

  habitInput.focus();
}

/* =========================================================
   EDIT
   ========================================================= */

function editHabit(habitId) {

  const habit =
    data.habits.find(
      item =>
        item.id === habitId
    );

  if (!habit) {
    return;
  }

  const updatedName =
    window.prompt(
      "Edit habit name:",
      habit.name
    );

  if (updatedName === null) {
    return;
  }

  const name =
    updatedName
      .trim()
      .slice(0, 50);

  if (!name) {

    window.alert(
      "Habit name cannot be empty."
    );

    return;
  }

  const duplicate =
    data.habits.some(
      item =>
        item.id !== habitId &&
        item.name.toLowerCase() ===
        name.toLowerCase()
    );

  if (duplicate) {

    window.alert(
      "A habit with this name already exists."
    );

    return;
  }

  habit.name = name;

  saveData();

  render();
}

/* =========================================================
   COMPLETION
   ========================================================= */

function toggleCompletion(
  habitId,
  dateKey,
  button
) {

  const habit =
    data.habits.find(
      item =>
        item.id === habitId
    );

  if (!habit) {
    return;
  }

  const date =
    parseDateKey(dateKey);

  if (isFutureDate(date)) {
    return;
  }

  const completed =
    habit.completions[dateKey] === true;

  if (completed) {

    delete habit.completions[
      dateKey
    ];

  } else {

    habit.completions[
      dateKey
    ] = true;

    playCompletionAnimation(
      button
    );
  }

  updatePermanentBestStreak();

  saveData();

  render();
}

/* =========================================================
   ANIMATION
   ========================================================= */

function playCompletionAnimation(button) {

  if (!button) {
    return;
  }

  button.classList.remove(
    "completion-pop"
  );

  void button.offsetWidth;

  button.classList.add(
    "completion-pop"
  );

  setTimeout(() => {

    button.classList.remove(
      "completion-pop"
    );

  }, 450);
}

/* =========================================================
   DELETE
   ========================================================= */

function deleteHabit(habitId) {

  const index =
    data.habits.findIndex(
      habit =>
        habit.id === habitId
    );

  if (index === -1) {
    return;
  }

  const habit =
    data.habits[index];

  const confirmed =
    window.confirm(
      `Delete "${habit.name}"?\n\nYou will have 5 seconds to undo this deletion.`
    );

  if (!confirmed) {
    return;
  }

  data.habits.splice(
    index,
    1
  );

  saveData();

  render();

  showUndoDelete(
    habit,
    index
  );
}

/* =========================================================
   UNDO
   ========================================================= */

function showUndoDelete(
  habit,
  originalIndex
) {

  clearTimeout(
    deleteUndoTimer
  );

  let toast =
    document.getElementById(
      "ritmoUndoToast"
    );

  if (!toast) {

    toast =
      document.createElement(
        "div"
      );

    toast.id =
      "ritmoUndoToast";

    toast.className =
      "ritmo-undo-toast";

    document.body.appendChild(
      toast
    );
  }

  toast.innerHTML = "";

  const message =
    document.createElement(
      "span"
    );

  message.textContent =
    `"${habit.name}" deleted`;

  const undoButton =
    document.createElement(
      "button"
    );

  undoButton.type =
    "button";

  undoButton.textContent =
    "Undo";

  undoButton.addEventListener(
    "click",
    () => {

      data.habits.splice(
        Math.min(
          originalIndex,
          data.habits.length
        ),
        0,
        habit
      );

      updatePermanentBestStreak();

      saveData();

      render();

      toast.classList.remove(
        "is-visible"
      );

      setTimeout(() => {

        if (toast.isConnected) {
          toast.remove();
        }

      }, 200);

      clearTimeout(
        deleteUndoTimer
      );
    }
  );

  toast.append(
    message,
    undoButton
  );

  requestAnimationFrame(() => {

    toast.classList.add(
      "is-visible"
    );
  });

  deleteUndoTimer =
    setTimeout(() => {

      toast.classList.remove(
        "is-visible"
      );

      setTimeout(() => {

        if (toast.isConnected) {
          toast.remove();
        }

      }, 250);

    }, 5000);
}

/* =========================================================
   WEEK NAVIGATION
   ========================================================= */

function getWeekDates() {

  return Array.from(
    { length: 7 },
    (_, index) =>
      addDays(
        viewedWeekStart,
        index
      )
  );
}

function goToPreviousWeek() {

  viewedWeekStart =
    addDays(
      viewedWeekStart,
      -7
    );

  render();
}

function goToNextWeek() {

  viewedWeekStart =
    addDays(
      viewedWeekStart,
      7
    );

  render();
}

function goToToday() {

  viewedWeekStart =
    startOfWeek(
      new Date()
    );

  render();
}

/* =========================================================
   WEEK HEADER
   ========================================================= */

function renderWeekHeader() {

  const thisWeek =
    startOfWeek(
      new Date()
    );

  if (weekLabel) {

    weekLabel.textContent =
      isSameDate(
        viewedWeekStart,
        thisWeek
      )
        ? "This Week"
        : formatWeekRange(
            viewedWeekStart
          );
  }

  if (dateElement) {

    dateElement.textContent =
      formatDate(
        new Date()
      );
  }

  if (todayBtn) {

    todayBtn.disabled =
      isSameDate(
        viewedWeekStart,
        thisWeek
      );
  }
}

/* =========================================================
   DAY BUTTON
   ========================================================= */

function createDayButton(
  habit,
  date
) {

  const key =
    getDateKey(date);

  const completed =
    habit.completions[key] === true;

  const future =
    isFutureDate(date);

  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.className =
    "day-cell";

  button.dataset.habitId =
    habit.id;

  button.dataset.date =
    key;

  if (completed) {

    button.classList.add(
      "is-complete"
    );
  }

  if (future) {

    button.classList.add(
      "is
