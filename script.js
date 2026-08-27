/* =========================================================
   RITMO
   Complete Habit Tracker Engine
========================================================= */

"use strict";


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "ritmo-v4-data";


/* =========================================================
   DOM
========================================================= */

const habitInput =
  document.getElementById("habitInput");

const addHabitBtn =
  document.getElementById("addHabitBtn");

const habitMatrix =
  document.getElementById("habitMatrix");

const emptyState =
  document.getElementById("emptyState");

const progressPercent =
  document.getElementById("progressPercent");

const progressRing =
  document.getElementById("progressRing");

const completedCount =
  document.getElementById("completedCount");

const totalHabits =
  document.getElementById("totalHabits");

const bestStreak =
  document.getElementById("bestStreak");

const weekLabel =
  document.getElementById("weekLabel");

const dateElement =
  document.getElementById("date");

const previousWeekBtn =
  document.getElementById("previousWeekBtn");

const nextWeekBtn =
  document.getElementById("nextWeekBtn");

const todayBtn =
  document.getElementById("todayBtn");


/* =========================================================
   CONSTANTS
========================================================= */

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];


/* =========================================================
   STATE
========================================================= */

let viewedWeekStart =
  startOfWeek(new Date());

let data =
  loadData();


/* =========================================================
   DATE FUNCTIONS
========================================================= */

function pad(value) {

  return String(value).padStart(2, "0");

}


function getDateKey(date = new Date()) {

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
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

  const result =
    new Date(
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

  const result =
    new Date(date);

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

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const target =
    new Date(date);

  target.setHours(
    0,
    0,
    0,
    0
  );

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

  const end =
    addDays(start, 6);

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
        month: "short"
      }
    );

  return `${startText} – ${endText}`;

}


/* =========================================================
   DATA
========================================================= */

function createEmptyData() {

  return {
    version: 4,

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

  Object.entries(completions)
    .forEach(([key, value]) => {

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        value === true
      ) {

        result[key] = true;

      }

    });

  return result;

}


function normalizeData(raw) {

  const clean =
    createEmptyData();

  if (
    !raw ||
    typeof raw !== "object"
  ) {

    return clean;

  }


  if (
    Array.isArray(raw.habits)
  ) {

    clean.habits =
      raw.habits
        .filter(habit => {

          return (
            habit &&
            typeof habit === "object" &&
            String(habit.name || "").trim()
          );

        })
        .map(habit => {

          return {

            id:
              String(
                habit.id ||
                `${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2)}`
              ),

            name:
              String(habit.name)
                .trim()
                .slice(0, 50),

            createdAt:
              habit.createdAt ||
              new Date().toISOString(),

            completions:
              normalizeCompletions(
                habit.completions
              )

          };

        });

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

    legacy.forEach((habit, index) => {

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

    });

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
      .filter(key => {

        return (
          habit.completions[key] === true
        );

      })
      .sort();

  if (dates.length === 0) {
    return 0;
  }

  let best = 1;

  let current = 1;

  for (
    let i = 1;
    i < dates.length;
    i++
  ) {

    const difference =
      Math.round(
        (
          parseDateKey(dates[i]) -
          parseDateKey(dates[i - 1])
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

  data.habits.forEach(habit => {

    data.stats.bestStreak =
      Math.max(

        data.stats.bestStreak,

        calculateBestStreak(habit)

      );

  });

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
    data.habits.some(habit => {

      return (
        habit.name.toLowerCase() ===
        name.toLowerCase()
      );

    });


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
   TOGGLE COMPLETION
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
   DELETE HABIT
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
      `Delete "${habit.name}"?`
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
    {
      length: 7
    },
    (_, index) => {

      return addDays(
        viewedWeekStart,
        index
      );

    }
  );

}


/* =========================================================
   WEEK HEADER
========================================================= */

function renderWeekHeader() {

  weekLabel.textContent =
    formatWeekRange(
      viewedWeekStart
    );


  dateElement.textContent =
    formatDate(
      new Date()
    );


  const currentWeek =
    startOfWeek(
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


  button.disabled =
    future;


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


  if (
    data.habits.length === 0
  ) {

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


  dates.forEach(date => {

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

  });


  habitMatrix.appendChild(header);


  /* HABITS */

  data.habits.forEach(habit => {

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

    deleteButton.type =
      "button";

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


    dates.forEach(date => {

      row.appendChild(
        createDayButton(
          habit,
          date
        )
      );

    });


    habitMatrix.appendChild(row);

  });

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


  bestStreak.textContent =
    data.stats.bestStreak;


  progressPercent.textContent =
    `${percentage}%`;


  /* Progress ring */

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

addHabitBtn.addEventListener(
  "click",
  addHabit
);


habitInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      event.preventDefault();

      addHabit();

    }

  }
);


previousWeekBtn.addEventListener(
  "click",
  () => {

    viewedWeekStart =
      addDays(
        viewedWeekStart,
        -7
      );

    render();

  }
);


nextWeekBtn.addEventListener(
  "click",
  () => {

    const nextWeek =
      addDays(
        viewedWeekStart,
        7
      );


    const currentWeek =
      startOfWeek(
        new Date()
      );


    if (
      nextWeek <= currentWeek
    ) {

      viewedWeekStart =
        nextWeek;

      render();

    }

  }
);


todayBtn.addEventListener(
  "click",
  () => {

    viewedWeekStart =
      startOfWeek(
        new Date()
      );

    render();

  }
);


/* =========================================================
   START
========================================================= */

updatePermanentBestStreak();

saveData();

render();
