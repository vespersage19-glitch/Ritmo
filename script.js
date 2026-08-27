/* =========================================================
   RITMO — PHASE 3
   Stable Completion
   Streaks
   Week Navigation
   Edit Habit
   Safe Delete + Undo
   Progress & History
   Local Recovery
========================================================= */

"use strict";

const STORAGE_KEY = "ritmo-v3-data";
const BACKUP_KEY = "ritmo-v3-backup";

const habitInput = document.getElementById("habitInput");
const addHabitBtn = document.getElementById("addHabitBtn");

const habitMatrix = document.getElementById("habitMatrix");
const emptyState = document.getElementById("emptyState");

const progressPercent = document.getElementById("progressPercent");
const progressRing = document.getElementById("progressRing");

const completedCount = document.getElementById("completedCount");
const totalHabits = document.getElementById("totalHabits");
const bestStreak = document.getElementById("bestStreak");

const weekLabel = document.getElementById("weekLabel");
const dateElement = document.getElementById("date");

const previousWeekBtn = document.getElementById("previousWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const todayBtn = document.getElementById("todayBtn");

const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("historyPanel");
const historyCloseBtn = document.getElementById("historyCloseBtn");

const historyList = document.getElementById("historyList");
const historyTotalHabits = document.getElementById("historyTotalHabits");
const historyBestStreak = document.getElementById("historyBestStreak");
const historyTotalCompletions = document.getElementById("historyTotalCompletions");

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];

const PROGRESS_RADIUS = 43;
const PROGRESS_CIRCUMFERENCE =
  2 * Math.PI * PROGRESS_RADIUS;

let viewedWeekStart = startOfWeek(new Date());
let data = loadData();
let deleteUndoTimer = null;


/* =========================================================
   DATE
========================================================= */

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
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
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}

function formatWeekRange(start) {
  const end = addDays(start, 6);

  const startText = start.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });

  const endText = end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

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

  const clean = {};

  Object.entries(completions).forEach(
    ([key, value]) => {

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        value === true
      ) {
        clean[key] = true;
      }

    }
  );

  return clean;
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
        .map(
          habit => ({
            id:
              String(
                habit.id ||
                createHabitId()
              ),

            name:
              String(
                habit.name
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
          })
        );

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

  const result = createEmptyData();

  try {

    const raw =
      localStorage.getItem("ritmo-habits");

    if (!raw) {
      return result;
    }

    const legacy = JSON.parse(raw);

    if (!Array.isArray(legacy)) {
      return result;
    }

    legacy.forEach(
      (habit, index) => {

        if (
          !habit ||
          !String(habit.name || "").trim()
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

  }
  catch (error) {

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

  }
  catch (error) {

    console.error(
      "Primary data recovery required:",
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

    }
    catch (backupError) {

      console.error(
        "Backup recovery failed:",
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

  }
  catch (error) {

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

  if (dates.length === 0) {
    return 0;
  }

  let best = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {

    const previous =
      parseDateKey(
        dates[i - 1]
      );

    const currentDate =
      parseDateKey(
        dates[i]
      );

    const difference =
      Math.round(
        (
          currentDate -
          previous
        ) / 86400000
      );

    if (difference === 1) {
      current++;
    }
    else {
      current = 1;
    }

    best =
      Math.max(
        best,
        current
      );
  }

  return best;
}

function calculateCurrentStreak(habit) {

  let cursor = new Date();

  let streak = 0;

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

  return Object.values(
    habit.completions || {}
  ).filter(
    value =>
      value === true
  ).length;
}


/* =========================================================
   ADD
========================================================= */

function addHabit() {

  const name =
    habitInput.value.trim();

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

    alert(
      "This habit already exists."
    );

    habitInput.focus();
    habitInput.select();

    return;
  }

  data.habits.push({

    id:
      createHabitId(),

    name:
      name.slice(0, 50),

    createdAt:
      new Date().toISOString(),

    completions: {}

  });

  habitInput.value = "";

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
    updatedName.trim();

  if (!name) {
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

    alert(
      "A habit with this name already exists."
    );

    return;
  }

  habit.name =
    name.slice(0, 50);

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

  }
  else {

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

  setTimeout(
    () => {
      button.classList.remove(
        "completion-pop"
      );
    },
    450
  );
}


/* =========================================================
   DELETE + UNDO
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
      `Delete "${habit.name}"?\n\nYou can undo this deletion for 5 seconds.`
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

      toast.remove();

      clearTimeout(
        deleteUndoTimer
      );

    }
  );

  toast.append(
    message,
    undoButton
  );

  requestAnimationFrame(
    () => {
      toast.classList.add(
        "is-visible"
      );
    }
  );

  deleteUndoTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "is-visible"
        );

        setTimeout(
          () => {

            if (
              toast.isConnected
            ) {
              toast.remove();
            }

          },
          250
        );

      },
      5000
    );
}


/* =========================================================
   WEEK NAVIGATION
========================================================= */

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

  const currentWeek =
    startOfWeek(
      new Date()
    );

  weekLabel.textContent =
    isSameDate(
      viewedWeekStart,
      currentWeek
    )
      ? "This Week"
      : formatWeekRange(
          viewedWeekStart
        );

  dateElement.textContent =
    formatDate(
      new Date()
    );

  todayBtn.disabled =
    isSameDate(
      viewedWeekStart,
      currentWeek
    );
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

  if (completed) {
    button.classList.add(
      "is-complete"
    );
  }

  if (future) {
    button.classList.add(
      "is-future"
    );
  }

  button.disabled =
    future;

  button.setAttribute(
    "aria-label",
    `${habit.name}, ${DAY_NAMES[date.getDay()]} ${formatDate(date)}: ${
      completed
        ? "completed"
        : "not completed"
    }`
  );

  if (completed) {

    const tick =
      document.createElement(
        "span"
      );

    tick.className =
      "completion-tick";

    tick.textContent =
      "✓";

    button.appendChild(
      tick
    );
  }

  button.addEventListener(
    "click",
    () => {

      toggleCompletion(
        habit.id,
        key,
        button
      );

    }
  );

  return button;
}


/* =========================================================
   MATRIX
========================================================= */

function renderMatrix(dates) {

  habitMatrix.innerHTML = "";

  if (data.habits.length === 0) {

    emptyState.hidden =
      false;

    return;
  }

  emptyState.hidden =
    true;

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "matrix-row matrix-header";

  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "habit-column matrix-heading";

  heading.textContent =
    "Habit";

  header.appendChild(
    heading
  );

  dates.forEach(
    date => {

      const day =
        document.createElement(
          "div"
        );

      day.className =
        "day-column";

      if (
        isSameDate(
          date,
          new Date()
        )
      ) {
        day.classList.add(
          "is-today"
        );
      }

      const name =
        document.createElement(
          "span"
        );

      name.className =
        "day-name";

      name.textContent =
        DAY_NAMES[
          date.getDay()
        ];

      const number =
        document.createElement(
          "span"
        );

      number.className =
        "day-date";

      number.textContent =
        date.getDate();

      day.append(
        name,
        number
      );

      header.appendChild(
        day
      );

    }
  );

  habitMatrix.appendChild(
    header
  );


  data.habits.forEach(
    habit => {

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "matrix-row habit-row";


      const habitColumn =
        document.createElement(
          "div"
        );

      habitColumn.className =
        "habit-column";


      const info =
        document.createElement(
          "div"
        );

      info.className =
        "habit-info";


      const name =
        document.createElement(
          "div"
        );

      name.className =
        "habit-name";

      name.textContent =
        habit.name;


      const currentStreak =
        calculateCurrentStreak(
          habit
        );

      const streak =
        document.createElement(
          "div"
        );

      streak.className =
        "habit-streak";

      streak.innerHTML =
        `Current streak: <strong>${currentStreak}</strong> day${currentStreak === 1 ? "" : "s"}`;


      const actions =
        document.createElement(
          "div"
        );

      actions.className =
        "habit-actions";


      const edit =
        document.createElement(
          "button"
        );

      edit.type =
        "button";

      edit.className =
        "edit-button";

      edit.textContent =
        "Edit";

      edit.addEventListener(
        "click",
        () => {
          editHabit(
            habit.id
          );
        }
      );


      const remove =
    
