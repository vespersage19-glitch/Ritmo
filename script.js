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
    editButton.textConte = "Edit";
    editButton.dataset.habitId = habit.id;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.habitId = habit.id;

    actions.append(editButton, deleteButton);

    habitColumn.append(info, actions);
    row.appendChild(habitColumn);

    dates.forEach(date => {
      row.appendChild(createDayButton(habit, date));
    });

    habitMatrix.appendChild(row);
  });
}

/* 
=========================================================
   STATS
========================================================= */

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

/*
=========================================================
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
/*
=========================================================
   RENDER
========================================================= */

function render() {
  renderWeekHeader();
  renderMatrix(getWeekDates());
  updateStats();

  if (historyOpen) {
    renderHistory();
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
