const habitInput =
  document.getElementById("habitInput");

const addHabitBtn =
  document.getElementById("addHabitBtn");

const habitList =
  document.getElementById("habitList");

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

const dateElement =
  document.getElementById("date");


/* ================================
   LOAD SAVED HABITS
================================ */

let habits =
  JSON.parse(
    localStorage.getItem("ritmo-habits")
  ) || [];


/* ================================
   DATE HELPERS
================================ */

function getDateKey(date = new Date()) {

  const year =
    date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, "0");

  const day =
    String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


function getYesterdayKey() {

  const yesterday =
    new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  return getDateKey(yesterday);

}


/* ================================
   TODAY'S DATE
================================ */

const today = new Date();

dateElement.textContent =
  today.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });


/* ================================
   SAVE HABITS
================================ */

function saveHabits() {

  localStorage.setItem(
    "ritmo-habits",
    JSON.stringify(habits)
  );

}


/* ================================
   ADD HABIT
================================ */

function addHabit() {

  const name =
    habitInput.value.trim();


  if (!name) {

    habitInput.focus();

    return;

  }


  const newHabit = {

    id: Date.now(),

    name: name,

    completed: false,

    streak: 0,

    bestStreak: 0,

    lastCompletedDate: null

  };


  habits.push(newHabit);


  habitInput.value = "";


  saveHabits();

  renderHabits();

}


/* ================================
   COMPLETE / UNCOMPLETE HABIT
================================ */

function toggleHabit(id) {

  const todayKey =
    getDateKey();

  const yesterdayKey =
    getYesterdayKey();


  habits =
    habits.map(habit => {

      if (habit.id !== id) {

        return habit;

      }


      /* UNCHECK HABIT */

      if (habit.completed) {

        habit.completed = false;

        /*
          Removing today's completion
          restores the previous streak.
        */

        if (
          habit.lastCompletedDate ===
          todayKey
        ) {

          if (
            habit.streak > 0
          ) {

            habit.streak--;

          }


          habit.lastCompletedDate =
            null;

        }

        return habit;

      }


      /* CHECK HABIT */

      habit.completed = true;


      /*
        If this habit was completed
        yesterday, continue the streak.
      */

      if (
        habit.lastCompletedDate ===
        yesterdayKey
      ) {

        habit.streak++;

      }

      /*
        If it was not completed yesterday,
        start a new streak.
      */

      else {

        habit.streak = 1;

      }


      /*
        Update the best streak only
        when the current streak is higher.
      */

      if (
        habit.streak >
        (habit.bestStreak || 0)
      ) {

        habit.bestStreak =
          habit.streak;

      }


      habit.lastCompletedDate =
        todayKey;


      return habit;

    });


  saveHabits();

  renderHabits();

}


/* ================================
   DELETE HABIT
================================ */

function deleteHabit(id) {

  habits =
    habits.filter(
      habit => habit.id !== id
    );


  saveHabits();

  renderHabits();

}


/* ================================
   RESET OLD COMPLETION
================================ */

function updateDailyStatus() {

  const todayKey =
    getDateKey();


  habits =
    habits.map(habit => {

      /*
        If the habit was completed
        on a previous day, it should
        appear unchecked today.
      */

      if (
        habit.completed &&
        habit.lastCompletedDate !==
        todayKey
      ) {

        habit.completed = false;

      }


      return habit;

    });


  saveHabits();

}


/* ================================
   DISPLAY HABITS
================================ */

function renderHabits() {

  habitList.innerHTML = "";


  if (habits.length === 0) {

    emptyState.style.display =
      "block";

  } else {

    emptyState.style.display =
      "none";

  }


  habits.forEach(habit => {

    const habitElement =
      document.createElement("div");


    habitElement.className =
      `habit ${
        habit.completed
          ? "completed"
          : ""
      }`;


    habitElement.innerHTML = `

      <button
        class="check-button"
        onclick="toggleHabit(${habit.id})"
        aria-label="Complete habit">
      </button>


      <div class="habit-info">

        <div class="habit-name">
          ${escapeHTML(habit.name)}
        </div>

        <div class="streak">
          🔥 ${habit.streak} day streak
        </div>

      </div>


      <button
        class="delete-button"
        onclick="deleteHabit(${habit.id})"
        aria-label="Delete habit">

        ×

      </button>

    `;


    habitList.appendChild(
      habitElement
    );

  });


  updateStats();

}


/* ================================
   UPDATE STATISTICS
================================ */

function updateStats() {

  const total =
    habits.length;


  const completed =
    habits.filter(
      habit => habit.completed
    ).length;


  const percentage =
    total === 0
      ? 0
      : Math.round(
          (completed / total) * 100
        );


  const highestBestStreak =
    habits.length === 0
      ? 0
      : Math.max(
          ...habits.map(
            habit =>
              habit.bestStreak ||
              habit.streak ||
              0
          )
        );


  totalHabits.textContent =
    total;


  completedCount.textContent =
    completed;


  progressPercent.textContent =
    `${percentage}%`;


  bestStreak.textContent =
    highestBestStreak;

}


/* ================================
   PROTECT USER INPUT
================================ */

function escapeHTML(text) {

  const div =
    document.createElement("div");

  div.textContent =
    text;

  return div.innerHTML;

}


/* ================================
   ADD BUTTON
================================ */

addHabitBtn.addEventListener(
  "click",
  addHabit
);


/* ================================
   ENTER KEY
================================ */

habitInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      addHabit();

    }

  }
);


/* ================================
   START APP
================================ */

updateDailyStatus();

renderHabits();
