require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
// const Campground = require("./models/campground");
// const Comment = require("./models/comment");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const logger = require("morgan");

app.use(logger("dev"));

// Requiring routes
const commentRoutes = require("./routes/comments");
const campgroundRoutes = require("./routes/campgrounds");
const indexRoutes = require("./routes/index");

mongoose.set("strictQuery", false);

main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect(process.env.DATABASEURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.use(methodOverride("_method"));
app.use(flash());

// PASSPORT CONFIG
app.use(
  require("express-session")({
    secret: "shibas are the best dogs in the world.",
    resave: false,
    saveUninitialized: false,
  })
);
app.locals.moment = require("moment");
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);

app.get("*", function (req, res) {
  res.render("error");
});

app.listen(process.env.PORT || 3000, function () {
  console.log("listening on http://localhost:3000/");
});
