/* =========================================================
   RITMO — COMPLETE SCRIPT
   Weekly Sunday → Saturday
   Permanent history
   Permanent Best Streak
========================================================= */

const STORAGE_KEY = "ritmo-v3-data";

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

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];

let viewedWeekStart;
let data;


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
  const parts = key.split("-").map(Number);

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


function normalizeCompletions(completions) {
  if (
    !completions ||
    typeof completions !== "object"
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
    typeof raw !== "object"
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
            String(
              habit.name || ""
            ).trim()
        )

        .map(
          habit => ({
            id:
              String(
                habit.id ||
                `${Date.now()}-${Math.random()}`
              ),

            name:
              String(
                habit.name
              )
              .trim()
              .slice(0, 50),

            createdAt:
              habit.createdAt ||
              new Date().toISOString(),

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
   LOAD OLD DATA
========================================================= */

function migrateLegacyData() {

  const result = createEmptyData();

  try {

    const raw =
      localStorage.getItem(
        "ritmo-habits"
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
            String(
              habit.name
            )
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
      "Ritmo load error:",
      error
    );

  }

  return migrateLegacyData();
}


function saveData() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

  }

  catch (error) {

    console.error(
      "Ritmo save error:",
      error
    );

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

  dates.forEach(
    key => {

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
        }
        else {
          current = 1;
        }

      }
      else {
        current = 1;
      }

      best =
        Math.max(
          best,
          current
        );

      previous = key;

    }
  );

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

  let cursor = new Date();

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

  data.habits.forEach(
    habit => {

      data.stats.bestStreak =
        Math.max(
          data.stats.bestStreak,
          calculateBestStreak(habit)
        );

    }
  );
}


/* =========================================================
   ADD HABIT
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

    habitInput.focus();
    habitInput.select();

    return;
  }

  data.habits.push({

    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

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
   TOGGLE
========================================================= */

function toggleCompletion(
  habitId,
  dateKey
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

  if (
    habit.completions[dateKey] === true
  ) {

    delete habit.completions[dateKey];

  }
  else {

    habit.completions[dateKey] = true;

  }

  updatePermanentBestStreak();

  saveData();

  render();
}


/* =========================================================
   DELETE
========================================================= */

function deleteHabit(habitId) {

  const habit =
    data.habits.find(
      item =>
        item.id === habitId
    );

  if (!habit) {
    return;
  }

  const confirmed =
    window.confirm(
      `Delete "${habit.name}"? Your Best Streak will be kept.`
    );

  if (!confirmed) {
    return;
  }

  data.habits =
    data.habits.filter(
      item =>
        item.id !== habitId
    );

  saveData();

  render();
}


/* =========================================================
   WEEK
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

  if (weekLabel) {

    weekLabel.textContent =
      formatWeekRange(
        viewedWeekStart
      );

  }

  if (dateElement) {

    dateElement.textContent =
      formatDate(
        new Date()
      );

  }

  const thisWeek =
    startOfWeek(
      new Date()
    );

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
    document.createElement("button");

  button.type = "button";

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

  button.disabled = future;

  button.setAttribute(
    "aria-label",
    `${habit.name}, ${
      DAY_NAMES[date.getDay()]
    } ${formatDate(date)}: ${
      completed
        ? "completed"
        : "not completed"
    }`
  );

  if (completed) {

    const tick =
      document.createElement("span");

    tick.textContent = "✓";

    tick.setAttribute(
      "aria-hidden",
      "true"
    );

    button.appendChild(tick);
  }

  button.addEventListener(
    "click",
    () => {

      toggleCompletion(
        habit.id,
        key
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

    emptyState.hidden = false;

    return;
  }

  emptyState.hidden = true;


  /* HEADER */

  const header =
    document.createElement("div");

  header.className =
    "matrix-row matrix-header";

  const habitHeading =
    document.createElement("div");

  habitHeading.className =
    "habit-column matrix-heading";

  habitHeading.textContent =
    "Habit";

  header.appendChild(
    habitHeading
  );


  dates.forEach(
    date => {

      const day =
        document.createElement("div");

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
        document.createElement("span");

      name.className =
        "day-name";

      name.textContent =
        DAY_NAMES[
          date.getDay()
        ];

      const number =
        document.createElement("span");

      number.className =
        "day-date";

      number.textContent =
        date.getDate();

      day.append(
        name,
        number
      );

      header.appendChild(day);

    }
  );

  habitMatrix.appendChild(header);


  /* HABITS */

  data.habits.forEach(
    habit => {

      const row =
        document.createElement("div");

      row.className =
        "matrix-row habit-row";

      const habitColumn =
        document.createElement("div");

      habitColumn.className =
        "habit-column";

      const info =
        document.createElement("div");

      info.className =
        "habit-info";

      const name =
        document.createElement("span");

      name.className =
        "habit-name";

      name.textContent =
        habit.name;

      const streak =
        document.createElement("span");

      streak.className =
        "habit-streak";

      const currentStreak =
        calculateCurrentStreak(
          habit
        );

      streak.textContent =
        currentStreak > 0
          ? `${currentStreak} day streak`
          : "No active streak";

      info.append(
        name,
        streak
      );


      const deleteButton =
        document.createElement("button");

      deleteButton.type = "button";

      deleteButton.className =
        "delete-button";

      deleteButton.textContent =
        "Delete";

      deleteButton.addEventListener(
        "click",
        () => {

          deleteHabit(
            habit.id
          );

        }
      );


      habitColumn.append(
        info,
        deleteButton
      );

      row.appendChild(
        habitColumn
      );


      dates.forEach(
        date => {

          row.appendChild(
            createDayButton(
              habit,
              date
            )
          );

        }
      );


      habitMatrix.appendChild(row);

    }
  );
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

  const todayKey =
    getDateKey();

  const total =
    data.habits.length;

  const completed =
    data.habits.filter(
      habit =>
        habit.completions[
          todayKey
        ] === true
    ).length;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (
            completed /
            total
          ) * 100
        );

  totalHabits.textContent =
    total;

  completedCount.textContent =
    completed;

  progressPercent.textContent =
    `${percentage}%`;

  bestStreak.textContent =
    data.stats.bestStreak;


  if (progressRing) {

    const radius = 43;

    const circumference =
      2 *
      Math.PI *
      radius;

    progressRing.style.strokeDasharray =
      circumference;

    progressRing.style.strokeDashoffset =
      circumference -
      (
        percentage /
        100
      ) *
      circumference;
  }
}


/* =========================================================
   RENDER
========================================================= */

function render() {

  renderWeekHeader();

  renderMatrix(
    getWeekDates()
  );

  updateStats();
}


/* =========================================================
   EVENTS
========================================================= */

if (addHabitBtn) {

  addHabitBtn.addEventListener(
    "click",
    addHabit
  );

}


if (habitInput) {

  habitInput.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        event.preventDefault();

        addHabit();

      }

    }
  );

}


if (previousWeekBtn) {

  previousWeekBtn.addEventListener(
    "click",
    goToPreviousWeek
  );

}


if (nextWeekBtn) {

  nextWeekBtn.addEventListener(
    "click",
    goToNextWeek
  );

}


if (todayBtn) {

  todayBtn.addEventListener(
    "click",
    goToToday
  );

}


/* =========================================================
   START RITMO
========================================================= */

data = loadData();

updatePermanentBestStreak();

viewedWeekStart =
  startOfWeek(
    new Date()
  );

saveData();

render();
