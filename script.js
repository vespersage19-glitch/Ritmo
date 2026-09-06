/* =========================================================
   RITMO — COMPLETE STABLE SCRIPT
   Works with existing index.html + style.css
========================================================= */

const STORAGE_KEY = "ritmo-v3-data";
const BACKUP_KEY = "ritmo-v3-backup";
const LEGACY_KEY = "ritmo-habits";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PROGRESS_RADIUS = 43;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

let data = null;
let viewedWeekStart = null;
let deleteUndoTimer = null;
let historyOpen = false;

let habitInput, addHabitBtn, habitMatrix, emptyState;
let progressPercent, progressRing;
let completedCount, totalHabits, bestStreak;
let weekLabel, dateElement;
let previousWeekBtn, nextWeekBtn, todayBtn;
let historyBtn, historyPanel, historyCloseBtn, historyList;
let historyTotalHabits, historyBestStreak, historyTotalCompletions;

/* Habit Details + Progress Graph state */
let detailsOverlay, detailsCard;
let detailsHabitId = null;

/* =========================================================
   INIT
========================================================= */

function initRitmo() {
  cacheElements();
  data = loadData();
  updatePermanentBestStreak();
  viewedWeekStart = startOfWeek(new Date());
  setupEvents();
  saveData();
  render();
}

function cacheElements() {
  habitInput = document.getElementById("habitInput");
  addHabitBtn = document.getElementById("addHabitBtn");
  habitMatrix = document.getElementById("habitMatrix");
  emptyState = document.getElementById("emptyState");

  progressPercent = document.getElementById("progressPercent");
  progressRing = document.getElementById("progressRing");

  completedCount = document.getElementById("completedCount");
  totalHabits = document.getElementById("totalHabits");
  bestStreak = document.getElementById("bestStreak");

  weekLabel = document.getElementById("weekLabel");
  dateElement = document.getElementById("date");

  previousWeekBtn = document.getElementById("previousWeekBtn");
  nextWeekBtn = document.getElementById("nextWeekBtn");
  todayBtn = document.getElementById("todayBtn");

  historyBtn = document.getElementById("historyBtn");
  historyPanel = document.getElementById("historyPanel");
  historyCloseBtn = document.getElementById("historyCloseBtn");
  historyList = document.getElementById("historyList");

  historyTotalHabits = document.getElementById("historyTotalHabits");
  historyBestStreak = document.getElementById("historyBestStreak");
  historyTotalCompletions = document.getElementById("historyTotalCompletions");
}

/* =========================================================
   EVENTS (attached once, not re-attached on render)
========================================================= */

function setupEvents() {

  if (addHabitBtn) {
    addHabitBtn.addEventListener("click", addHabit);
  }

  if (habitInput) {
    habitInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addHabit();
      }
    });
  }

  if (previousWeekBtn) {
    previousWeekBtn.addEventListener("click", goToPreviousWeek);
  }

  if (nextWeekBtn) {
    nextWeekBtn.addEventListener("click", goToNextWeek);
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", goToToday);
  }

  if (historyBtn) {
    historyBtn.addEventListener("click", toggleHistory);
  }

  if (historyCloseBtn) {
    historyCloseBtn.addEventListener("click", closeHistory);
  }

  /*
    Single delegated click handler for the whole matrix.
    Handles day-cell clicks, edit clicks, delete clicks —
    even though those buttons are recreated on every render.
  */
  if (habitMatrix) {

    habitMatrix.addEventListener("click", event => {

      const dayButton = event.target.closest(".day-cell");

      if (dayButton) {

        if (dayButton.disabled) {
          return;
        }

        const habitId = dayButton.dataset.habitId;
        const dateKey = dayButton.dataset.date;

        if (!habitId || !dateKey) {
          return;
        }

        toggleCompletion(habitId, dateKey, dayButton);
        return;
      }

      const editButton = event.target.closest(".edit-button");

      if (editButton) {
        const habitId = editButton.dataset.habitId;
        if (habitId) {
          editHabit(habitId);
        }
        return;
      }

      const deleteButton = event.target.closest(".delete-button");

      if (deleteButton) {
        const habitId = deleteButton.dataset.habitId;
        if (habitId) {
          deleteHabit(habitId);
        }
        return;
      }

      const detailsButton = event.target.closest(".details-button");

      if (detailsButton) {
        const habitId = detailsButton.dataset.habitId;
        if (habitId) {
          openHabitDetails(habitId);
        }
      }
    });
  }
}

/* =========================================================
   DATE HELPERS
========================================================= */

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDateKey(date = new Date()) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function parseDateKey(key) {
  const parts = key.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function isSameDate(first, second) {
  return getDateKey(first) === getDateKey(second);
}

function isFutureDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target > today;
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatWeekRange(start) {
  const end = addDays(start, 6);
  const startText = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const endText = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${startText} – ${endText}`;
}

/* =========================================================
   DATA
========================================================= */

function createEmptyData() {
  return {
    version: 3,
    habits: [],
    stats: { bestStreak: 0 }
  };
}

function createHabitId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function normalizeCompletions(completions) {

  if (!completions || typeof completions !== "object" || Array.isArray(completions)) {
    return {};
  }

  const result = {};

  Object.entries(completions).forEach(([key, value]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && value === true) {
      result[key] = true;
    }
  });

  return result;
}

function normalizeData(raw) {

  const clean = createEmptyData();

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return clean;
  }

  if (Array.isArray(raw.habits)) {

    clean.habits = raw.habits
      .filter(habit => habit && typeof habit === "object" && String(habit.name || "").trim())
      .map(habit => ({
        id: String(habit.id || createHabitId()),
        name: String(habit.name || "").trim().slice(0, 50),
        createdAt: typeof habit.createdAt === "string" ? habit.createdAt : new Date().toISOString(),
        completions: normalizeCompletions(habit.completions)
      }));
  }

  const savedBest = Number(raw.stats && raw.stats.bestStreak);

  if (Number.isFinite(savedBest) && savedBest >= 0) {
    clean.stats.bestStreak = Math.floor(savedBest);
  }

  return clean;
}

/* =========================================================
   LEGACY MIGRATION
========================================================= */

function migrateLegacyData() {

  const result = createEmptyData();

  try {

    const raw = localStorage.getItem(LEGACY_KEY);

    if (!raw) {
      return result;
    }

    const legacy = JSON.parse(raw);

    if (!Array.isArray(legacy)) {
      return result;
    }

    legacy.forEach((habit, index) => {

      if (!habit || !String(habit.name || "").trim()) {
        return;
      }

      const completions = {};

      if (habit.completed === true && /^\d{4}-\d{2}-\d{2}$/.test(habit.lastCompletedDate || "")) {
        completions[habit.lastCompletedDate] = true;
      }

      result.habits.push({
        id: String(habit.id || `${Date.now()}-${index}`),
        name: String(habit.name).trim().slice(0, 50),
        createdAt: new Date().toISOString(),
        completions
      });

      result.stats.bestStreak = Math.max(
        result.stats.bestStreak,
        Number(habit.bestStreak) || 0,
        Number(habit.streak) || 0
      );
    });

  } catch (error) {
    console.error("Ritmo migration error:", error);
  }

  return result;
}

/* =========================================================
   STORAGE
========================================================= */

function loadData() {

  try {

    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return normalizeData(JSON.parse(saved));
    }

  } catch (error) {

    console.error("Ritmo primary storage error:", error);

    try {

      const backup = localStorage.getItem(BACKUP_KEY);

      if (backup) {
        return normalizeData(JSON.parse(backup));
      }

    } catch (backupError) {
      console.error("Ritmo backup recovery error:", backupError);
    }
  }

  return migrateLegacyData();
}

function saveData() {

  try {

    const serialized = JSON.stringify(data);
    const previous = localStorage.getItem(STORAGE_KEY);

    if (previous) {
      localStorage.setItem(BACKUP_KEY, previous);
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    return true;

  } catch (error) {
    console.error("Ritmo save error:", error);
    return false;
  }
}

/* =========================================================
   STREAK ENGINE
========================================================= */

function calculateBestStreak(habit) {

  const dates = Object.keys(habit.completions || {})
    .filter(key => habit.completions[key] === true)
    .sort();

  let best = 0;
  let current = 0;
  let previous = null;

  dates.forEach(key => {

    if (previous) {

      const difference = Math.round((parseDateKey(key) - parseDateKey(previous)) / 86400000);

      if (difference === 1) {
        current++;
      } else {
        current = 1;
      }

    } else {
      current = 1;
    }

    best = Math.max(best, current);
    previous = key;
  });

  return best;
}

function calculateCurrentStreak(habit) {

  const todayKey = getDateKey();

  if (habit.completions[todayKey] !== true) {
    return 0;
  }

  let streak = 0;
  let cursor = new Date();

  while (habit.completions[getDateKey(cursor)] === true) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function updatePermanentBestStreak() {

  let highest = Number(data.stats.bestStreak) || 0;

  data.habits.forEach(habit => {
    highest = Math.max(highest, calculateBestStreak(habit));
  });

  data.stats.bestStreak = highest;
}

function countTotalCompletions(habit) {
  return Object.keys(habit.completions || {})
    .filter(key => habit.completions[key] === true)
    .length;
}

/* =========================================================
   ADD HABIT
========================================================= */

function addHabit() {

  const name = habitInput.value.trim().slice(0, 50);

  if (!name) {
    habitInput.focus();
    return;
  }

  const exists = data.habits.some(habit => habit.name.toLowerCase() === name.toLowerCase());

  if (exists) {
    window.alert("This habit already exists.");
    habitInput.focus();
    habitInput.select();
    return;
  }

  data.habits.push({
    id: createHabitId(),
    name,
    createdAt: new Date().toISOString(),
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

  const habit = data.habits.find(item => item.id === habitId);

  if (!habit) {
    return;
  }

  const updatedName = window.prompt("Edit habit name:", habit.name);

  if (updatedName === null) {
    return;
  }

  const name = updatedName.trim().slice(0, 50);

  if (!name) {
    window.alert("Habit name cannot be empty.");
    return;
  }

  const duplicate = data.habits.some(
    item => item.id !== habitId && item.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    window.alert("A habit with this name already exists.");
    return;
  }

  habit.name = name;

  saveData();
  render();
}

/* =========================================================
   COMPLETION
========================================================= */

function toggleCompletion(habitId, dateKey, button) {

  const habit = data.habits.find(item => item.id === habitId);

  if (!habit) {
    return;
  }

  const date = parseDateKey(dateKey);

  if (isFutureDate(date)) {
    return;
  }

  const completed = habit.completions[dateKey] === true;

  if (completed) {
    delete habit.completions[dateKey];
  } else {
    habit.completions[dateKey] = true;
    playCompletionAnimation(button);
  }

  updatePermanentBestStreak();
  saveData();
  render();
}

function playCompletionAnimation(button) {

  if (!button) {
    return;
  }

  button.classList.remove("completion-pop");
  void button.offsetWidth;
  button.classList.add("completion-pop");

  setTimeout(() => {
    button.classList.remove("completion-pop");
  }, 450);
}

/* =========================================================
   DELETE
========================================================= */

function deleteHabit(habitId) {

  const index = data.habits.findIndex(habit => habit.id === habitId);

  if (index === -1) {
    return;
  }

  const habit = data.habits[index];

  const confirmed = window.confirm(
    `Delete "${habit.name}"?\n\nYou will have 5 seconds to undo this deletion.`
  );

  if (!confirmed) {
    return;
  }

  data.habits.splice(index, 1);

  updatePermanentBestStreak();
  saveData();
  render();

  showUndoDelete(habit, index);
}

/* =========================================================
   UNDO
========================================================= */

function showUndoDelete(habit, originalIndex) {

  clearTimeout(deleteUndoTimer);

  let toast = document.getElementById("ritmoUndoToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "ritmoUndoToast";
    toast.className = "ritmo-undo-toast";
    document.body.appendChild(toast);
  }

  toast.innerHTML = "";

  const message = document.createElement("span");
  message.textContent = `"${habit.name}" deleted`;

  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.textContent = "Undo";

  undoButton.addEventListener("click", () => {

    data.habits.splice(Math.min(originalIndex, data.habits.length), 0, habit);

    updatePermanentBestStreak();
    saveData();
    render();

    toast.classList.remove("is-visible");

    setTimeout(() => {
      if (toast.isConnected) {
        toast.remove();
      }
    }, 200);

    clearTimeout(deleteUndoTimer);
  });

  toast.append(message, undoButton);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  deleteUndoTimer = setTimeout(() => {

    toast.classList.remove("is-visible");

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
  return Array.from({ length: 7 }, (_, index) => addDays(viewedWeekStart, index));
}

function goToPreviousWeek() {
  viewedWeekStart = addDays(viewedWeekStart, -7);
  render();
}

function goToNextWeek() {
  viewedWeekStart = addDays(viewedWeekStart, 7);
  render();
}

function goToToday() {
  viewedWeekStart = startOfWeek(new Date());
  render();
}

/* =========================================================
   WEEK HEADER
========================================================= */

function renderWeekHeader() {

  const thisWeek = startOfWeek(new Date());

  if (weekLabel) {
    weekLabel.textContent = isSameDate(viewedWeekStart, thisWeek)
      ? "This Week"
      : formatWeekRange(viewedWeekStart);
  }

  if (dateElement) {
    dateElement.textContent = formatDate(new Date());
  }

  if (todayBtn) {
    todayBtn.disabled = isSameDate(viewedWeekStart, thisWeek);
  }
}

/* =========================================================
   DAY BUTTON
========================================================= */

function createDayButton(habit, date) {

  const key = getDateKey(date);
  const completed = habit.completions[key] === true;
  const future = isFutureDate(date);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "day-cell";
  button.dataset.habitId = habit.id;
  button.dataset.date = key;

  if (completed) {
    button.classList.add("is-complete");
  }

  if (future) {
    button.classList.add("is-future");
  }

  button.disabled = future;

  button.setAttribute(
    "aria-label",
    `${habit.name}, ${DAY_NAMES[date.getDay()]} ${formatDate(date)}: ${completed ? "completed" : "not completed"}`
  );

  if (completed) {
    const tick = document.createElement("span");
    tick.textContent = "✓";
    tick.className = "completion-tick";
    tick.setAttribute("aria-hidden", "true");
    button.appendChild(tick);
  }

  return button;
}

/* =========================================================
   MATRIX
========================================================= */

function renderMatrix(dates) {

  habitMatrix.innerHTML = "";

  if (data.habits.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  /* HEADER ROW */

  const header = document.createElement("div");
  header.className = "matrix-row matrix-header";

  const habitHeading = document.createElement("div");
  habitHeading.className = "habit-column matrix-heading";
  habitHeading.textContent = "Habit";
  header.appendChild(habitHeading);

  dates.forEach(date => {

    const day = document.createElement("div");
    day.className = "day-column";

    if (isSameDate(date, new Date())) {
      day.classList.add("is-today");
    }

    const name = document.createElement("span");
    name.className = "day-name";
    name.textContent = DAY_NAMES[date.getDay()];

    const number = document.createElement("span");
    number.className = "day-date";
    number.textContent = date.getDate();

    day.append(name, number);
    header.appendChild(day);
  });

  habitMatrix.appendChild(header);

  /* HABIT ROWS */

  data.habits.forEach(habit => {

    const row = document.createElement("div");
    row.className = "matrix-row habit-row";

    const habitColumn = document.createElement("div");
    habitColumn.className = "habit-column";

    const info = document.createElement("div");
    info.className = "habit-info";

    const name = document.createElement("span");
    name.className = "habit-name";
    name.textContent = habit.name;

    const currentStreak = calculateCurrentStreak(habit);
    const best = calculateBestStreak(habit);

    const streak = document.createElement("span");
    streak.className = "habit-streak";

    if (currentStreak > 0) {
      streak.innerHTML = `<strong>${currentStreak}</strong> day${currentStreak === 1 ? "" : "s"} active`;
    } else if (best > 0) {
      streak.innerHTML = `<strong>${best}</strong> best`;
    } else {
      streak.textContent = "Start your streak";
    }

    info.append(name, streak);

    const actions = document.createElement("div");
    actions.className = "habit-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-button";
    editButton.textContent = "Edit";
    editButton.dataset.habitId = habit.id;

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "details-button";
    detailsButton.textContent = "Details";
    detailsButton.dataset.habitId = habit.id;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.habitId = habit.id;

    actions.append(detailsButton, editButton, deleteButton);

    habitColumn.append(info, actions);
    row.appendChild(habitColumn);

    dates.forEach(date => {
      row.appendChild(createDayButton(habit, date));
    });

    habitMatrix.appendChild(row);
  });
}

/* =========================================================
   STATS
======================================================== */
function updateStats() {

  const todayKey = getDateKey();
  const total = data.habits.length;

  const completed = data.habits.filter(habit => habit.completions[todayKey] === true).length;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (totalHabits) totalHabits.textContent = total;
  if (completedCount) completedCount.textContent = completed;
  if (progressPercent) progressPercent.textContent = `${percentage}%`;
  if (bestStreak) bestStreak.textContent = data.stats.bestStreak;

  if (progressRing) {
    progressRing.style.strokeDasharray = PROGRESS_CIRCUMFERENCE;
    progressRing.style.strokeDashoffset =
      PROGRESS_CIRCUMFERENCE - (percentage / 100) * PROGRESS_CIRCUMFERENCE;
  }
}

/* =========================================================
   HISTORY PANEL
========================================================= */

function toggleHistory() {
  if (historyOpen) {
    closeHistory();
  } else {
    openHistory();
  }
}

function openHistory() {

  if (!historyPanel) {
    return;
  }

  historyOpen = true;
  historyPanel.hidden = false;
  renderHistory();
}

function closeHistory() {

  if (!historyPanel) {
    return;
  }

  historyOpen = false;
  historyPanel.hidden = true;
}

function renderHistory() {

  if (!historyList) {
    return;
  }

  const totalHabitsCount = data.habits.length;
  const totalCompletions = data.habits.reduce((sum, habit) => sum + countTotalCompletions(habit), 0);

  if (historyTotalHabits) historyTotalHabits.textContent = totalHabitsCount;
  if (historyBestStreak) historyBestStreak.textContent = data.stats.bestStreak;
  if (historyTotalCompletions) historyTotalCompletions.textContent = totalCompletions;

  historyList.innerHTML = "";

  if (totalHabitsCount === 0) {

    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No habits tracked yet.";
    historyList.appendChild(empty);
    return;
  }

  data.habits.forEach(habit => {

    const row = document.createElement("div");
    row.className = "history-habit";

    const left = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = habit.name;

    const completions = document.createElement("small");
    const total = countTotalCompletions(habit);
    completions.textContent = `${total} completion${total === 1 ? "" : "s"}`;

    left.append(name, completions);

    const right = document.createElement("div");
    right.className = "history-streak";

    const best = document.createElement("strong");
    best.textContent = calculateBestStreak(habit);

    const label = document.createElement("small");
    label.textContent = "Best Streak";

    right.append(best, label);

    row.append(left, right);
    historyList.appendChild(row);
  });
}

/* =========================================================
   HABIT DETAILS — STATS
========================================================= */

function computeHabitStats(habit) {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = new Date(habit.createdAt);
  created.setHours(0, 0, 0, 0);

  const daysSinceCreated = Math.max(1, Math.round((today - created) / 86400000) + 1);

  const totalCompletions = countTotalCompletions(habit);
  const completionRate = Math.round((totalCompletions / daysSinceCreated) * 100);

  const currentStreak = calculateCurrentStreak(habit);
  const bestStreakValue = calculateBestStreak(habit);

  const status = computeTrendStatus(habit, daysSinceCreated, today);

  return {
    daysSinceCreated,
    totalCompletions,
    completionRate,
    currentStreak,
    bestStreak: bestStreakValue,
    status
  };
}

/*
  Trend logic — exact deterministic algorithm:

  1. Build the full chronological daily series for the habit, from its
     creation date through today. Each day contributes 100 (completed)
     or 0 (not completed) — no invented or estimated values.
  2. Split that series into a chronological first half and second half.
  3. Compare the average of the second half to the average of the
     first half.
  4. difference >= +10 points -> "Improving"
     difference <= -10 points -> "Declining"
     otherwise                -> "Stable"
  5. Fewer than MIN_DAYS days of recorded history (so each half would
     have less than 2 days) -> "Not enough data".
*/

function averageOf(values) {

  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeTrendStatus(habit, daysSinceCreated, today) {

  const MIN_DAYS = 4;
  const THRESHOLD = 10;

  if (daysSinceCreated < MIN_DAYS) {
    return "Not enough data";
  }

  const series = [];

  for (let i = daysSinceCreated - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    series.push(habit.completions[getDateKey(day)] === true ? 100 : 0);
  }

  const halfSize = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, halfSize);
  const secondHalf = series.slice(series.length - halfSize);

  const difference = averageOf(secondHalf) - averageOf(firstHalf);

  if (difference >= THRESHOLD) {
    return "Improving";
  }

  if (difference <= -THRESHOLD) {
    return "Declining";
  }

  return "Stable";
}

function statusMeta(status) {

  switch (status) {

    case "Improving":
      return { label: "↑ Improving", className: "status-building" };

    case "Declining":
      return { label: "↓ Declining", className: "status-declining" };

    case "Stable":
      return { label: "→ Stable", className: "status-stable" };

    default:
      return { label: "→ Not enough data", className: "status-unknown" };
  }
}

/*
=================
   HABIT DETAILS — GRAPH
========================================================= */

const GRAPH_SVG_WIDTH = 300;
const GRAPH_SVG_HEIGHT = 140;
const GRAPH_PADDING = 10;
const GRAPH_ROLLING_WINDOW = 7;

/*
  Builds the complete recorded history for a habit, from its creation
  date through today — no range selection, no fake/estimated days.

  Each day's real completion (0 or 100) is kept as its own data point
  (every actual day is represented). The plotted value is a trailing
  rolling average of those real values, which is what turns a boolean
  daily record into a readable rising/falling line — it is a derived
  statistic of real data, never invented data.
*/
function buildGraphSeries(habit) {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = new Date(habit.createdAt);
  created.setHours(0, 0, 0, 0);

  const totalDays = Math.max(1, Math.round((today - created) / 86400000) + 1);

  const raw = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    raw.push(habit.completions[getDateKey(day)] === true ? 100 : 0);
  }

  const points = raw.map((_, index) => {

    const windowStart = Math.max(0, index - (GRAPH_ROLLING_WINDOW - 1));
    const windowSlice = raw.slice(windowStart, index + 1);
    const rate = windowSlice.reduce((sum, value) => sum + value, 0) / windowSlice.length;

    return { rate };
  });

  return {
    points,
    startLabel: formatDate(created),
    endLabel: "Today"
  };
}

/* =========================================================
   HABIT DETAILS — MODAL
========================================================= */

function ensureHabitDetailsOverlay() {

  if (detailsOverlay) {
    return;
  }

  detailsOverlay = document.createElement("div");
  detailsOverlay.className = "habit-details-overlay";

  detailsCard = document.createElement("div");
  detailsCard.className = "habit-details-card";

  detailsCard.innerHTML = `
    <div class="habit-details-header">
      <div>
        <p class="section-label">HABIT DETAILS</p>
        <h2 class="habit-details-title"></h2>
      </div>
      <button type="button" class="history-close habit-details-close">Close</button>
    </div>

    <span class="habit-details-status"></span>
    <p class="current-date habit-details-meta"></p>

    <div class="habit-details-stats">
      <div class="history-stat">
        <strong class="hd-current-streak">0</strong>
        <small>Current Streak</small>
      </div>
      <div class="history-stat">
        <strong class="hd-best-streak">0</strong>
        <small>Best Streak</small>
      </div>
      <div class="history-stat">
        <strong class="hd-total-completions">0</strong>
        <small>Total Completions</small>
      </div>
      <div class="history-stat">
        <strong class="hd-completion-rate">0%</strong>
        <small>Completion Rate</small>
      </div>
    </div>

    <p class="section-label">CONSISTENCY</p>

    <div class="graph-wrap">
      <svg class="graph-svg" viewBox="0 0 ${GRAPH_SVG_WIDTH} ${GRAPH_SVG_HEIGHT}" preserveAspectRatio="none"></svg>
      <div class="graph-labels">
        <span class="graph-label-start"></span>
        <span class="graph-label-end"></span>
      </div>
    </div>
  `;

  detailsOverlay.appendChild(detailsCard);
  document.body.appendChild(detailsOverlay);

  detailsOverlay.addEventListener("click", event => {
    if (event.target === detailsOverlay) {
      closeHabitDetails();
    }
  });

  detailsCard.querySelector(".habit-details-close").addEventListener("click", closeHabitDetails);
}

function openHabitDetails(habitId) {

  ensureHabitDetailsOverlay();

  detailsHabitId = habitId;

  renderHabitDetails();

  detailsOverlay.classList.add("is-visible");
}

function closeHabitDetails() {

  if (!detailsOverlay) {
    return;
  }

  detailsOverlay.classList.remove("is-visible");
  detailsHabitId = null;
}

function renderHabitDetails() {

  if (!detailsHabitId) {
    return;
  }

  const habit = data.habits.find(item => item.id === detailsHabitId);

  if (!habit) {
    closeHabitDetails();
    return;
  }

  const stats = computeHabitStats(habit);
  const meta = statusMeta(stats.status);

  detailsCard.querySelector(".habit-details-title").textContent = habit.name;

  const statusEl = detailsCard.querySelector(".habit-details-status");
  statusEl.textContent = meta.label;
  statusEl.className = `habit-details-status ${meta.className}`;

  detailsCard.querySelector(".habit-details-meta").textContent =
    `Started ${stats.daysSinceCreated} day${stats.daysSinceCreated === 1 ? "" : "s"} ago`;

  detailsCard.querySelector(".hd-current-streak").textContent = stats.currentStreak;
  detailsCard.querySelector(".hd-best-streak").textContent = stats.bestStreak;
  detailsCard.querySelector(".hd-total-completions").textContent = stats.totalCompletions;
  detailsCard.querySelector(".hd-completion-rate").textContent = `${stats.completionRate}%`;

  renderDetailsGraph(habit);
}

/*
  Injects one small stylesheet, once, purely from JavaScript, so the
  new SVG line graph renders correctly without editing style.css.
  Colors reference the existing --accent theme variable (with a
  fallback) so it inherits Ritmo's real theme wherever that variable
  is defined.
*/
function ensureGraphStyles() {

  if (document.getElementById("ritmoGraphStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ritmoGraphStyles";
  style.textContent = `
    .graph-svg {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }
    .graph-grid-line {
      stroke: rgba(255, 255, 255, 0.08);
      stroke-width: 1;
    }
    .graph-axis-label {
      fill: rgba(255, 255, 255, 0.45);
      font-size: 7px;
    }
    .graph-line {
      fill: none;
      stroke: var(--accent, #22c55e);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .graph-dot {
      fill: var(--accent, #22c55e);
      opacity: 0.5;
    }
    .graph-dot-current {
      opacity: 1;
    }
    .graph-empty-label {
      fill: rgba(255, 255, 255, 0.45);
      font-size: 10px;
      text-anchor: middle;
    }
  `;

  document.head.appendChild(style);
}

function renderDetailsGraph(habit) {

  ensureGraphStyles();

  const { points, startLabel, endLabel } = buildGraphSeries(habit);

  const svg = detailsCard.querySelector(".graph-svg");
  const startLabelEl = detailsCard.querySelector(".graph-label-start");
  const endLabelEl = detailsCard.querySelector(".graph-label-end");

  if (!svg) {
    return;
  }

  if (!points.length) {
    svg.innerHTML = `<text x="${GRAPH_SVG_WIDTH / 2}" y="${GRAPH_SVG_HEIGHT / 2}" class="graph-empty-label">No progress data yet</text>`;
    if (startLabelEl) startLabelEl.textContent = "";
    if (endLabelEl) endLabelEl.textContent = "";
    return;
  }

  const plotWidth = GRAPH_SVG_WIDTH - GRAPH_PADDING * 2;
  const plotHeight = GRAPH_SVG_HEIGHT - GRAPH_PADDING * 2;

  const xFor = index => {
    if (points.length === 1) {
      return GRAPH_PADDING + plotWidth / 2;
    }
    return GRAPH_PADDING + (index / (points.length - 1)) * plotWidth;
  };

  const yFor = rate => GRAPH_PADDING + (1 - rate / 100) * plotHeight;

  const gridMarkup = [0, 25, 50, 75, 100]
    .map(mark => {
      const y = yFor(mark).toFixed(2);
      return `<line x1="${GRAPH_PADDING}" y1="${y}" x2="${GRAPH_SVG_WIDTH - GRAPH_PADDING}" y2="${y}" class="graph-grid-line" /><text x="1" y="${(Number(y) + 3).toFixed(2)}" class="graph-axis-label">${mark}%</text>`;
    })
    .join("");

  const lineMarkup = points.length > 1
    ? `<polyline class="graph-line" points="${points
        .map((point, index) => `${xFor(index).toFixed(2)},${yFor(point.rate).toFixed(2)}`)
        .join(" ")}" />`
    : "";

  const dotsMarkup = points
    .map((point, index) => {
      const isLast = index === points.length - 1;
      const radius = isLast ? 3 : 1.4;
      return `<circle cx="${xFor(index).toFixed(2)}" cy="${yFor(point.rate).toFixed(2)}" r="${radius}" class="graph-dot${isLast ? " graph-dot-current" : ""}" />`;
    })
    .join("");

  svg.innerHTML = `${gridMarkup}${lineMarkup}${dotsMarkup}`;

  if (startLabelEl) startLabelEl.textContent = startLabel;
  if (endLabelEl) endLabelEl.textContent = points.length > 1 ? endLabel : "Not enough data";
}

/* =========================================================
   MONTHLY TRACKING — DATE HELPERS
========================================================= */

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthDayCount(monthStart) {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
}

function formatMonthLabel(monthStart) {
  return monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/*
  Only days that have actually occurred (up to today) count toward
  monthly stats — future days have no completion data and must not
  be treated as "missed" or counted as possible actions yet.
*/
function getElapsedMonthDays(monthStart) {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = getMonthDayCount(monthStart);
  const days = [];

  for (let i = 0; i < totalDays; i++) {
    const day = addDays(monthStart, i);
    if (day > today) {
      break;
    }
    days.push(day);
  }

  return days;
}

/* =========================================================
   MONTHLY TRACKING — STATS
========================================================= */

function computeMonthlyStats(monthStart) {

  const elapsedDays = getElapsedMonthDays(monthStart);
  const habits = data.habits;

  const perDay = elapsedDays.map(day => {

    const dateKey = getDateKey(day);
    const total = habits.length;
    const done = habits.filter(habit => habit.completions[dateKey] === true).length;

    return {
      date: day,
      dateKey,
      done,
      total,
      rate: total === 0 ? 0 : done / total
    };
  });

  const totalPossible = perDay.reduce((sum, entry) => sum + entry.total, 0);
  const totalCompleted = perDay.reduce((sum, entry) => sum + entry.done, 0);
  const completionPercent = totalPossible === 0
    ? 0
    : Math.round((totalCompleted / totalPossible) * 100);

  let bestDay = null;
  let worstDay = null;

  perDay.forEach(entry => {

    if (entry.total === 0) {
      return;
    }

    if (!bestDay || entry.rate > bestDay.rate) {
      bestDay = entry;
    }

    if (!worstDay || entry.rate < worstDay.rate) {
      worstDay = entry;
    }
  });

  const perHabit = habits.map(habit => {

    const doneCount = elapsedDays.filter(
      day => habit.completions[getDateKey(day)] === true
    ).length;

    const rate = elapsedDays.length === 0
      ? 0
      : Math.round((doneCount / elapsedDays.length) * 100);

    return {
      id: habit.id,
      name: habit.name,
      completed: doneCount,
      possible: elapsedDays.length,
      rate
    };
  });

  return {
    perDay,
    totalPossible,
    totalCompleted,
    completionPercent,
    bestDay,
    worstDay,
    perHabit,
    hasAnyHabits: habits.length > 0,
    hasElapsedDays: elapsedDays.length > 0
  };
}

/* =========================================================
   MONTHLY TRACKING — NAVIGATION
========================================================= */

function goToPreviousMonth() {
  viewedMonthStart = new Date(viewedMonthStart.getFullYear(), viewedMonthStart.getMonth() - 1, 1);
  renderMonthlyView();
}

function goToNextMonth() {
  viewedMonthStart = new Date(viewedMonthStart.getFullYear(), viewedMonthStart.getMonth() + 1, 1);
  renderMonthlyView();
}

function goToThisMonth() {
  viewedMonthStart = startOfMonth(new Date());
  renderMonthlyView();
}

/* =========================================================
   MONTHLY TRACKING — OVERLAY (JS-created, like the habit
   details overlay — index.html and style.css are not touched)
========================================================= */

function ensureMonthlyStyles() {

  if (document.getElementById("ritmoMonthlyStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ritmoMonthlyStyles";
  style.textContent = `
    .month-nav {
      display: flex;
      gap: 8px;
      margin: 12px 0;
    }
    .month-nav button {
      flex: 1;
      background: rgba(255, 255, 255, 0.06);
      border: none;
      border-radius: 8px;
      padding: 8px 6px;
      color: inherit;
      font-size: 13px;
    }
    .month-nav button:disabled {
      opacity: 0.4;
    }
    .month-calendar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin: 8px 0 16px;
    }
    .month-day-cell {
      aspect-ratio: 1 / 1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.04);
    }
    .month-day-cell.is-empty {
      background: transparent;
    }
    .month-day-cell.is-future {
      opacity: 0.35;
      background: rgba(255, 255, 255, 0.04);
    }
    .month-habit-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 13px;
    }
    .month-empty-note {
      opacity: 0.6;
      font-size: 13px;
      padding: 12px 0;
    }
  `;

  document.head.appendChild(style);
}

function ensureMonthlyOverlay() {

  if (monthOverlay) {
    return;
  }

  monthOverlay = document.createElement("div");
  monthOverlay.className = "habit-details-overlay";

  monthCard = document.createElement("div");
  monthCard.className = "habit-details-card";

  monthCard.innerHTML = `
    <div class="habit-details-header">
      <div>
        <p class="section-label">MONTHLY TRACKING</p>
        <h2 class="habit-details-title month-title"></h2>
      </div>
      <button type="button" class="history-close month-close">Close</button>
    </div>

    <div class="month-nav">
      <button type="button" class="month-prev">‹ Prev</button>
      <button type="button" class="month-today">This Month</button>
      <button type="button" class="month-next">Next ›</button>
    </div>

    <div class="habit-details-stats month-stats">
      <div class="history-stat">
        <strong class="month-completion-rate">0%</strong>
        <small>Completion Rate</small>
      </div>
      <div class="history-stat">
        <strong class="month-total-completed">0</strong>
        <small>Completed Actions</small>
      </div>
      <div class="history-stat">
        <strong class="month-total-possible">0</strong>
        <small>Possible Actions</small>
      </div>
      <div class="history-stat">
        <strong class="month-best-day">–</strong>
        <small>Best Day</small>
      </div>
      <div class="history-stat">
        <strong class="month-worst-day">–</strong>
        <small>Worst Day</small>
      </div>
    </div>

    <p class="section-label">CALENDAR</p>
    <div class="month-calendar"></div>

    <p class="section-label">HABIT BREAKDOWN</p>
    <div class="month-habit-list"></div>
  `;

  monthOverlay.appendChild(monthCard);
  document.body.appendChild(monthOverlay);

  monthOverlay.addEventListener("click", event => {
    if (event.target === monthOverlay) {
      closeMonthlyView();
    }
  });

  monthCard.querySelector(".month-close").addEventListener("click", closeMonthlyView);
  monthCard.querySelector(".month-prev").addEventListener("click", goToPreviousMonth);
  monthCard.querySelector(".month-next").addEventListener("click", goToNextMonth);
  monthCard.querySelector(".month-today").addEventListener("click", goToThisMonth);
}

function openMonthlyView() {

  ensureMonthlyOverlay();

  monthOpen = true;
  viewedMonthStart = startOfMonth(new Date());

  renderMonthlyView();

  monthOverlay.classList.add("is-visible");
}

function closeMonthlyView() {

  if (!monthOverlay) {
    return;
  }

  monthOverlay.classList.remove("is-visible");
  monthOpen = false;
}
/* =========================================================
   MONTHLY TRACKING — RENDER
========================================================= */

function renderMonthlyView() {

  if (!monthOverlay || !viewedMonthStart) {
    return;
  }

  ensureMonthlyStyles();

  const stats = computeMonthlyStats(viewedMonthStart);

  monthCard.querySelector(".month-title").textContent = formatMonthLabel(viewedMonthStart);

  const thisMonthStart = startOfMonth(new Date());
  const isCurrentMonth = thisMonthStart.getTime() === viewedMonthStart.getTime();
  monthCard.querySelector(".month-today").disabled = isCurrentMonth;

  monthCard.querySelector(".month-completion-rate").textContent = `${stats.completionPercent}%`;
  monthCard.querySelector(".month-total-completed").textContent = stats.totalCompleted;
  monthCard.querySelector(".month-total-possible").textContent = stats.totalPossible;

  monthCard.querySelector(".month-best-day").textContent = stats.bestDay
    ? formatDate(stats.bestDay.date)
    : "–";

  monthCard.querySelector(".month-worst-day").textContent = stats.worstDay
    ? formatDate(stats.worstDay.date)
    : "–";

  renderMonthlyCalendar(stats);
  renderMonthlyHabitBreakdown(stats);
}

function renderMonthlyCalendar(stats) {

  const container = monthCard.querySelector(".month-calendar");
  container.innerHTML = "";

  if (!stats.hasAnyHabits) {
    container.innerHTML = `<div class="month-empty-note">No habits tracked yet.</div>`;
    return;
  }

  const totalDaysInMonth = getMonthDayCount(viewedMonthStart);
  const leadingBlanks = viewedMonthStart.getDay();

  for (let i = 0; i < leadingBlanks; i++) {
    const blank = document.createElement("div");
    blank.className = "month-day-cell is-empty";
    container.appendChild(blank);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {

    const date = new Date(viewedMonthStart.getFullYear(), viewedMonthStart.getMonth(), dayNum);
    const cell = document.createElement("div");
    cell.className = "month-day-cell";
    cell.textContent = dayNum;

    if (date > today) {

      cell.classList.add("is-future");

    } else {

      const match = stats.perDay.find(entry => entry.dateKey === getDateKey(date));
      const rate = match ? match.rate : 0;

      cell.style.backgroundColor = "var(--accent, #22c55e)";
      cell.style.opacity = String(Math.max(0.12, rate));
    }

    container.appendChild(cell);
  }
}

function renderMonthlyHabitBreakdown(stats) {

  const container = monthCard.querySelector(".month-habit-list");
  container.innerHTML = "";

  if (!stats.hasAnyHabits) {
    container.innerHTML = `<div class="month-empty-note">No habits to show.</div>`;
    return;
  }

  if (!stats.hasElapsedDays) {
    container.innerHTML = `<div class="month-empty-note">This month hasn't started yet.</div>`;
    return;
  }

  stats.perHabit.forEach(entry => {

    const row = document.createElement("div");
    row.className = "month-habit-row";

    const name = document.createElement("span");
    name.textContent = entry.name;

    const rate = document.createElement("span");
    rate.textContent = `${entry.rate}% (${entry.completed}/${entry.possible})`;

    row.append(name, rate);
    container.appendChild(row);
  });
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  renderWeekHeader();
  renderMatrix(getWeekDates());
  updateStats();

  if (historyOpen) {
    renderHistory();
  }

  if (detailsHabitId) {
    renderHabitDetails();
  }

  if (monthOpen) {
    renderMonthlyView();
  }
}

/* =========================================================
   START RITMO
========================================================= */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRitmo);
} else {
  initRitmo();
}
