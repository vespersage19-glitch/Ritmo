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


/* LOAD SAVED HABITS */

let habits =
  JSON.parse(
    localStorage.getItem("ritmo-habits")
  ) || [];


/* TODAY'S DATE */

const today = new Date();

dateElement.textContent =
  today.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });


/* SAVE */

function saveHabits() {

  localStorage.setItem(
    "ritmo-habits",
    JSON.stringify(habits)
  );

}


/* ADD HABIT */

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

    streak: 0

  };


  habits.push(newHabit);


  habitInput.value = "";


  saveHabits();

  renderHabits();

}


/* COMPLETE HABIT */

function toggleHabit(id) {

  habits =
    habits.map(habit => {

      if (habit.id === id) {

        if (!habit.completed) {

          habit.completed = true;

          habit.streak++;

        } else {

          habit.completed = false;

          if (habit.streak > 0) {

            habit.streak--;

          }

        }

      }

      return habit;

    });


  saveHabits();

  renderHabits();

}


/* DELETE HABIT */

function deleteHabit(id) {

  habits =
    habits.filter(
      habit => habit.id !== id
    );


  saveHabits();

  renderHabits();

}


/* DISPLAY HABITS */

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


/* UPDATE STATISTICS */

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


  const highestStreak =
    habits.length === 0
      ? 0
      : Math.max(
          ...habits.map(
            habit => habit.streak
          )
        );


  totalHabits.textContent =
    total;


  completedCount.textContent =
    completed;


  progressPercent.textContent =
    `${percentage}%`;


  bestStreak.textContent =
    highestStreak;

}


/* PROTECT USER INPUT */

function escapeHTML(text) {

  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;

}


/* ADD BUTTON */

addHabitBtn.addEventListener(
  "click",
  addHabit
);


/* ENTER KEY */

habitInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      addHabit();

    }

  }
);


/* START APP */

renderHabits();
