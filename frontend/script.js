let recipes = [];

async function fetchRecipes(status = null) {
  try {
    let url = "http://localhost:3000/recipes";
    if (status) url += `?status=${encodeURIComponent(status)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Network response was not ok");
    recipes = await res.json();
    recipes = recipes.map((r) => ({ ...r, status: r.status || null }));
    render();
  } catch (err) {
    console.error("Failed to fetch recipes:", err);
    recipes = JSON.parse(localStorage.getItem("recipes")) || [];
    render();
  }
}

function save() {
  localStorage.setItem("recipes", JSON.stringify(recipes));
}

function render() {
  const container = document.getElementById("recipes");
  container.innerHTML = "";

  recipes.forEach((r, i) => {
    const status = r.status || "";

    const makeButton = (label) => {
      const isActive = status === label;
      return `<button class="status-btn ${
        isActive ? "active-status" : ""
      }" onclick="setStatus(${i}, '${label}')">${label}</button>`;
    };

    const div = document.createElement("div");
    div.className = "recipe";

    div.innerHTML = `
        <h2 contenteditable="true" onblur="editTitle(${i}, this.textContent)">${
      r.title
    }</h2>
        <p contenteditable="true" onblur="editDesc(${i}, this.textContent)">${
      r.description
    }</p>
  
        ${makeButton("Favorite")}
        ${makeButton("To Try")}
        ${makeButton("Made Before")}
        <button onclick="deleteRecipe(${i})">Delete</button>
  
        <p>Average rating: ${
          r.avg_rating ? r.avg_rating.toFixed(1) : "No ratings yet"
        } (${r.review_count || 0} reviews)</p>
  
        <div>
          <label>Rate this recipe:</label>
          <select id="rating-select-${r.id}">
            <option value="">--</option>
            <option value="1">1⭐</option>
            <option value="2">2⭐</option>
            <option value="3">3⭐</option>
            <option value="4">4⭐</option>
            <option value="5">5⭐</option>
          </select>
          <input type="text" id="comment-input-${
            r.id
          }" placeholder="Add a comment (optional)" />
          <button onclick="submitReview(${r.id})">Submit</button>
        </div>
  
        <div id="reviews-${r.id}"></div>
      `;

    container.appendChild(div);
    fetchReviews(r.id);
  });
}

async function submitReview(recipeId) {
  const ratingSelect = document.getElementById(`rating-select-${recipeId}`);
  const commentInput = document.getElementById(`comment-input-${recipeId}`);

  const rating = parseInt(ratingSelect.value);
  const comment = commentInput.value.trim();

  if (!rating) {
    alert("Please select a rating.");
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:3000/recipes/${recipeId}/reviews`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      }
    );

    if (!res.ok) throw new Error("Failed to submit review");

    // Clear inputs
    ratingSelect.value = "";
    commentInput.value = "";

    await fetchRecipes();
  } catch (err) {
    alert(err.message);
  }
}

async function fetchReviews(recipeId) {
  try {
    const res = await fetch(
      `http://localhost:3000/recipes/${recipeId}/reviews`
    );
    if (!res.ok) throw new Error("Failed to load reviews");
    const reviews = await res.json();

    const reviewsDiv = document.getElementById(`reviews-${recipeId}`);
    if (reviews.length === 0) {
      reviewsDiv.innerHTML = "<p>No reviews yet.</p>";
      return;
    }

    reviewsDiv.innerHTML = reviews
      .map(
        (r) =>
          `<p><strong>${r.rating}⭐</strong> - ${
            r.comment || "<i>No comment</i>"
          } <br/><small>${new Date(r.created_at).toLocaleString()}</small></p>`
      )
      .join("");
  } catch (err) {
    console.error(err);
  }
}

async function addrecipe(title, description, category_id = null) {
  try {
    const res = await fetch("http://localhost:3000/addrecipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category_id }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add recipe");
    }

    return await res.json();
  } catch (error) {
    console.error(error);
    alert("Failed to add recipe. See console for details.");
    return null;
  }
}

document
  .getElementById("recipe-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();

    if (title && description) {
      const newRecipe = await addrecipe(title, description);

      if (newRecipe) {
        recipes.push({
          id: newRecipe.id,
          title: newRecipe.title,
          description: newRecipe.description,
          status: null,
        });
        save();
        render();
        this.reset();
      }
    }
  });

document.getElementById("recipe-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const desc = document.getElementById("description").value.trim();
  if (title && desc) {
    addRecipe(title, desc);
    this.reset();
  }
});

async function deleteRecipe(index) {
  if (!confirm("Delete this recipe?")) return;

  const recipe = recipes[index];
  try {
    const res = await fetch(`http://localhost:3000/deleterecipe/${recipe.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete recipe");
    }

    recipes.splice(index, 1);
    save();
    render();
  } catch (error) {
    console.error(error);
    alert("Failed to delete recipe. See console for details.");
  }
}

async function editRecipe(index) {
  const recipe = recipes[index];
  try {
    const res = await fetch(`http://localhost:3000/editrecipe/${recipe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: recipe.title,
        description: recipe.description,
        category_id: recipe.category_id || null,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update recipe");
    }
  } catch (error) {
    console.error(error);
    alert("Failed to update recipe. See console for details.");
  }
}

function editTitle(index, newTitle) {
  recipes[index].title = newTitle;
  save();
  editRecipe(index);
}

function editDesc(index, newDesc) {
  recipes[index].description = newDesc;
  save();
  editRecipe(index);
}

async function setStatus(index, status) {
  recipes[index].status = status;
  save();
  render();

  const recipe = recipes[index];

  try {
    const res = await fetch(`http://localhost:3000/editrecipe/${recipe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: recipe.title,
        description: recipe.description,
        category_id: recipe.category_id || null,
        status: status,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update status");
    }
  } catch (error) {
    console.error(error);
    alert("Failed to update status. See console for details.");
  }
}

document.getElementById("search").addEventListener(
  "input",
  debounce(async function (e) {
    const query = e.target.value.trim();

    if (!query) {
      fetchRecipes();
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:3000/api/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Network response was not ok");
      recipes = await res.json();
      recipes = recipes.map((r) => ({ ...r, status: r.status || null }));
      render();
    } catch (err) {
      console.error("Search failed:", err);
      alert("Failed to search recipes");
    }
  }, 300)
);

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

document.getElementById("suggest-btn").addEventListener("click", async () => {
  const input = document.getElementById("user-ingredients").value.trim();
  if (!input) {
    alert("Please enter some ingredients.");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients: input }),
    });

    if (!res.ok) throw new Error("Failed to get suggestions");

    const data = await res.json();

    alert("AI Suggestion:\n" + data.suggestion);
  } catch (err) {
    console.error(err);
    alert("OpenAI quota exceeded, please try later..");
  }
});

let currentFilter = null;

fetchRecipes();
