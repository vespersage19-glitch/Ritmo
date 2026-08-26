/* =====================================================
   RITMO V3
   Permanent date-based habit tracking
===================================================== */

const STORAGE_KEY = "ritmo-v3";
const LEGACY_HABITS_KEY = "ritmo-habits";


/* =====================================================
   ELEMENTS
===================================================== */

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

const completedCount =
  document.getElementById("completedCount");

const totalHabits =
  document.getElementById("totalHabits");

const bestStreak =
  document.getElementById("bestStreak");

const weekLabel =
  document.getElementById("weekLabel");

const todayLabel =
  document.getElementById("todayLabel");

const previousWeekBtn =
  document.getElementById("previousWeekBtn");

const nextWeekBtn =
  document.getElementById("nextWeekBtn");

const currentWeekBtn =
  document.getElementById("currentWeekBtn");


/* =====================================================
   CONSTANTS
===================================================== */

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];


/*
  viewedWeekStart always represents Sunday
  of the currently displayed week.
*/

let viewedWeekStart =
  startOfWeek(new Date());


/*
  Main permanent application data.
*/

let data =
  loadData();


/* =====================================================
   DATE HELPERS
===================================================== */

function pad(value) {

  return String(value)
    .padStart(2, "0");

}


function getDateKey(
  date = new Date()
) {

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );

}


function parseDateKey(key) {

  const [
    year,
    month,
    day
  ] =
    key
      .split("-")
      .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );

}


function startOfWeek(date) {

  const result =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );


  /*
    JavaScript:
    Sunday = 0
    Monday = 1
    ...
    Saturday = 6
  */

  result.setDate(
    result.getDate() -
    result.getDay()
  );


  return result;

}


function addDays(
  date,
  amount
) {

  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
    amount
  );

  return result;

}


function isSameDate(
  first,
  second
) {

  return (
    getDateKey(first) ===
    getDateKey(second)
  );

}


function formatShortDate(date) {

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


  const sameYear =
    start.getFullYear() ===
    end.getFullYear();


  const startText =
    start.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",

        ...(sameYear
          ? {}
          : {
              year: "numeric"
            })
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


  return (
    `${startText} – ${endText}`
  );

}


/* =====================================================
   DATA STRUCTURE
===================================================== */

/*
  V3 DOES NOT store:

    completed: true/false
    streak: number
    lastCompletedDate

  Those values are derived from permanent history.

  Instead we store:

    completions: {
      "2026-08-24": true,
      "2026-08-25": true,
      "2026-08-26": true
    }

  This allows Ritmo to keep months and years
  of history.
*/


function makeEmptyData() {

  return {

    version: 3,

    habits: [],

    stats: {

      /*
        This number is deliberately independent
        from individual habits.

        Therefore deleting a habit cannot
        delete an earned Best Streak.
      */

      bestStreak: 0

    }

  };

}


/* =====================================================
   NORMALIZE SAVED DATA
===================================================== */

function normalizeData(raw) {

  const clean =
    makeEmptyData();


  if (
    !raw ||
    typeof raw !== "object"
  ) {

    return clean;

  }


  const habits =
    Array.isArray(raw.habits)
      ? raw.habits
      : [];


  clean.habits =
    habits

      .filter(
        habit =>
          habit &&
          typeof habit === "object" &&
          habit.name
      )

      .map(habit => {

        const completions =
          habit.completions &&
          typeof habit.completions === "object"
            ? Object.fromEntries(

                Object.entries(
                  habit.completions
                )

                .filter(
                  ([key, value]) =>
                    /^\d{4}-\d{2}-\d{2}$/.test(
                      key
                    ) &&
                    value === true
                )

              )

            : {};


        return {

          id:
            String(
              habit.id ??
              `${Date.now()}-${Math.random()}`
            ),

          name:
            String(habit.name)
              .trim()
              .slice(0, 50),

          createdAt:
            habit.createdAt ||
            new Date().toISOString(),

          completions

        };

      })

      .filter(
        habit => habit.name
      );


  clean.stats.bestStreak =
    Number.isFinite(
      Number(
        raw.stats?.bestStreak
      )
    )

      ? Math.max(
          0,
          Number(
            raw.stats.bestStreak
          )
        )

      : 0;


  return clean;

}


/* =====================================================
   LEGACY DATA MIGRATION
===================================================== */

/*
  Your previous Ritmo version stored:

    completed
    streak
    bestStreak
    lastCompletedDate

  We don't want existing data to simply disappear.

  So V3 attempts to migrate the old format.
*/


function migrateLegacyData() {

  try {

    const legacyRaw =
      localStorage.getItem(
        LEGACY_HABITS_KEY
      );


    if (!legacyRaw) {

      return makeEmptyData();

    }


    const legacyHabits =
      JSON.parse(legacyRaw);


    if (
      !Array.isArray(
        legacyHabits
      )
    ) {

      return makeEmptyData();

    }


    const migrated =
      makeEmptyData();


    migrated.habits =
      legacyHabits

        .filter(
          habit =>
            habit &&
            habit.name
        )

        .map(
          (
            habit,
            index
          ) => {

            const completions = {};


            /*
              We can safely preserve a completion
              when the old app tells us the exact
              last completed date.
            */

            if (
              habit.completed &&
              habit.lastCompletedDate
            ) {

              completions[
                habit.lastCompletedDate
              ] = true;

            }


            return {

              id:
                String(
                  habit.id ??
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

            };

          }
        );


    /*
      Preserve the old highest streak.

      This is especially important because
      V3 treats Best Streak as permanent.
    */

    const legacyBest =
      legacyHabits.reduce(

        (
          highest,
          habit
        ) => {

          return Math.max(
            highest,
            Number(
              habit?.bestStreak
            ) || 0,
            Number(
              habit?.streak
            ) || 0
          );

        },

        0

      );


    migrated.stats.bestStreak =
      legacyBest;


    if (
      migrated.habits.length
    ) {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          migrated
        )
      );

    }


    return migrated;

  } catch {

    return makeEmptyData();

  }

}


/* =====================================================
   LOAD DATA
===================================================== */

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

  } catch {

    /*
      If saved data is corrupted,
      try the older format instead.
    */

  }


  return migrateLegacyData();

}


/* =====================================================
   SAVE DATA
===================================================== */

function saveData() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );

}


/* =====================================================
   WEEK DATA
===================================================== */

function getWeekDates() {

  return Array.from(
    {
      length: 7
    },

    (_, index) =>
      addDays(
        viewedWeekStart,
        index
      )

  );

}


/* =====================================================
   FUTURE DATE CHECK
===================================================== */

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


/* =====================================================
   CURRENT STREAK
===================================================== */

function calculateCurrentStreak(
  habit
) {

  const today =
    new Date();


  const todayKey =
    getDateKey(today);


  /*
    A current streak exists only if today
    itself is completed.
  */

  if (
    !habit.completions[
      todayKey
    ]
  ) {

    return 0;

  }


  let streak = 0;

  let cursor =
    today;


  while (
    habit.completions[
      getDateKey(cursor)
    ]
  ) {

    streak += 1;

    cursor =
      addDays(
        cursor,
        -1
      );

  }


  return streak;

}


/* =====================================================
   BEST STREAK FOR ONE HABIT
===================================================== */

function calculateBestStreak(
  habit
) {

  const dates =
    Object.keys(
      habit.completions
    )

    .filter(
      key =>
        habit.completions[key]
    )

    .sort();


  let best = 0;

  let current = 0;

  let previous = null;


  for (
    const key of dates
  ) {

    if (previous) {

      const difference =
        Math.round(

          (
            parseDateKey(key) -
            parseDateKey(previous)
          ) / 86400000

        );


      current =
        difference === 1
          ? current + 1
          : 1;

    } else {

      current = 1;

    }


    best =
      Math.max(
        best,
        current
      );


    previous = key;

  }


  return best;

}


/* =====================================================
   PERMANENT BEST STREAK
===================================================== */

function updatePermanentBestStreak() {

  for (
    const habit of data.habits
  ) {

    const habitBest =
      calculateBestStreak(
        habit
      );


    data.stats.bestStreak =
      Math.max(
        data.stats.bestStreak,
        habitBest
      );

  }

}


/* =====================================================
   ADD HABIT
===================================================== */

function addHabit() {

  const name =
    habitInput.value.trim();


  if (!name) {

    habitInput.focus();

    return;

  }


  /*
    Prevent accidental duplicate habits.
  */

  const duplicate =
    data.habits.some(

      habit =>
        habit.name.toLowerCase() ===
        name.toLowerCase()

    );


  if (duplicate) {

    habitInput.focus();

    habitInput.select();

    return;

  }


  const newHabit = {

    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    name,

    createdAt:
      new Date().toISOString(),

    completions: {}

  };


  data.habits.push(
    newHabit
  );


  habitInput.value = "";


  saveData();

  render();

}


/* =====================================================
   TOGGLE COMPLETION
===================================================== */

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


  const targetDate =
    parseDateKey(dateKey);


  /*
    Future days cannot be checked.

    This prevents accidental "prediction"
    of future completions.
  */

  if (
    isFutureDate(
      targetDate
    )
  ) {

    return;

  }


  /*
    If already completed,
    remove that specific date.

    If not completed,
    save that specific date.
  */

  if (
    habit.completions[
      dateKey
    ]
  ) {

    delete habit.completions[
      dateKey
    ];

  } else {

    habit.completions[
      dateKey
    ] = true;


    /*
      Check whether this completion
      created a new all-time record.

      Once earned, this record stays.
    */

    data.stats.bestStreak =
      Math.max(
        data.stats.bestStreak,
        calculateBestStreak(
          habit
        )
      );

  }


  saveData();

  render();

}


/* =====================================================
   DELETE HABIT
===================================================== */

function deleteHabit(
  habitId
) {

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

      `Delete “${habit.name}”? ` +
      `Its earned Best Streak will be kept.`

    );


  if (!confirmed) {

    return;

  }


  /*
    IMPORTANT:

    We remove only the habit.

    We DO NOT touch:

      data.stats.bestStreak

    Therefore Best Streak survives deletion.
  */

  data.habits =
    data.habits.filter(
      item =>
        item.id !== habitId
    );


  saveData();

  render();

}


/* =====================================================
   WEEK HEADER
===================================================== */

function renderWeekHeader() {

  const dates =
    getWeekDates();


  const today =
    new Date();


  weekLabel.textContent =
    formatWeekRange(
      viewedWeekStart
    );


  todayLabel.textContent =
    `Today · ${formatShortDate(today)}`;


  currentWeekBtn.disabled =
    isSameDate(
      viewedWeekStart,
      startOfWeek(today)
    );


  return dates;

}


/* =====================================================
   ELEMENT CREATOR
===================================================== */

function createElement(
  tag,
  className,
  text
) {

  const element =
    document.createElement(tag);


  if (className) {

    element.className =
      className;

  }


  if (
    text !== undefined
  ) {

    element.textContent =
      text;

  }


  return element;

}


/* =====================================================
   RENDER MATRIX
===================================================== */

function renderMatrix(
  dates
) {

  habitMatrix.innerHTML = "";


  /*
    EMPTY STATE
  */

  if (
    !data.habits.length
  ) {

    emptyState.hidden =
      false;

    return;

  }


  emptyState.hidden =
    true;


  /*
    HEADER ROW
  */

  const header =
    createElement(
      "div",
      "matrix-row matrix-header"
    );


  const habitHeader =
    createElement(
      "div",
      "habit-column matrix-heading",
      "Habit"
    );


  header.appendChild(
    habitHeader
  );


  dates.forEach(
    (
      date,
      index
    ) => {

      const day =
        createElement(

          "div",

          `day-column ${
            isSameDate(
              date,
              new Date()
            )
              ? "is-today"
              : ""
          }`

        );


      day.appendChild(

        createElement(
          "span",
          "day-name",
          DAY_NAMES[index]
        )

      );


      day.appendChild(

        createElement(
          "span",
          "day-date",
          String(
            date.getDate()
          )
        )

      );


      header.appendChild(
        day
      );

    }
  );


  habitMatrix.appendChild(
    header
  );


  /*
    HABIT ROWS
  */

  data.habits.forEach(
    habit => {

      const row =
        createElement(
          "div",
          "matrix-row habit-row"
        );


      /*
        HABIT NAME COLUMN
      */

      const habitColumn =
        createElement(
          "div",
          "habit-column"
        );


      const info =
        createElement(
          "div",
          "habit-info"
        );


      info.appendChild(

        createElement(
          "span",
          "habit-name",
          habit.name
        )

      );


      const currentStreak =
        calculateCurrentStreak(
          habit
        );


      const streakText =
        currentStreak > 0

          ? `${currentStreak} day streak`

          : "No active streak";


      info.appendChild(

        createElement(
          "span",
          "habit-streak",
          streakText
        )

      );


      /*
        DELETE BUTTON
      */

      const deleteButton =
        createElement(
          "button",
          "delete-button",
          "Delete"
        );


      deleteButton.type =
        "button";


      deleteButton.setAttribute(
        "aria-label",
        `Delete ${habit.name}`
      );


      deleteButton.addEventListener(
        "click",
        () =>
          deleteHabit(
            habit.id
          )
      );


      habitColumn.append(
        info,
        deleteButton
      );


      row.appendChild(
        habitColumn
      );


      /*
        SEVEN DAILY CELLS
      */

      dates.forEach(
        date => {

          const key =
            getDateKey(
              date
            );


          const completed =
            habit.completions[
              key
            ] === true;


          const future =
            isFutureDate(
              date
            );


          const button =
            createElement(

              "button",

              `day-cell ${
                completed
                  ? "is-complete"
                  : ""
              } ${
                future
                  ? "is-future"
                  : ""
              }`

            );


          button.type =
            "button";


          button.disabled =
            future;


          button.setAttribute(

            "aria-label",

            `${habit.name}, ` +
            `${DAY_NAMES[date.getDay()]} ` +
            `${formatShortDate(date)}: ` +
            `${
              completed
                ? "completed"
                : "not completed"
            }`

          );


          if (completed) {

            button.innerHTML =
              `<span aria-hidden="true">✓</span>`;

          }


          button.addEventListener(
            "click",
            () =>
              toggleCompletion(
                habit.id,
                key
              )
          );


          row.appendChild(
            button
          );

        }
      );


      habitMatrix.appendChild(
        row
      );

    }
  );

}


/* =====================================================
   UPDATE STATS
===================================================== */

function updateStats() {

  con
