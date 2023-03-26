const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");
const Campground = require("../models/campground");
const Comment = require("../models/comment");
const middleware = require("../middleware");
const multer = require("multer");
const storage = multer.diskStorage({
  filename: function (req, file, callback) {
    callback(null, Date.now() + file.originalname);
  },
});
const imageFilter = function (req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};
const upload = multer({
  storage: storage,
  fileFilter: imageFilter,
});

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// root route
router.get("/", function (req, res) {
  if (req.user) {
    return res.redirect("/campgrounds");
  } else {
    res.render("landing");
  }
});

router.get("/about", function (req, res) {
  res.render("about");
});

// show register form
router.get("/register", function (req, res) {
  if (req.user) {
    return res.redirect("/campgrounds");
  } else {
    res.render("register");
  }
});

// handle sign up logic
router.post("/register", upload.single("image"), function (req, res) {
  if (req.file === undefined) {
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      fullName: req.body.fullName,
      image: "",
      imageId: "",
    });
    User.register(newUser, req.body.password, function (err, user) {
      if (err) {
        return res.render("register", {
          error: err.message,
        });
      }
      passport.authenticate("local")(req, res, function () {
        res.redirect("/campgrounds");
      });
    });
  } else {
    cloudinary.uploader.upload(
      req.file.path,
      {
        width: 400,
        height: 400,
        gravity: "center",
        crop: "scale",
      },
      function (err, result) {
        if (err) {
          req.flash("error", err.messsage);
          return res.redirect("back");
        }
        req.body.image = result.secure_url;
        req.body.imageId = result.public_id;
        const newUser = new User({
          username: req.body.username,
          email: req.body.email,
          phone: req.body.phone,
          fullName: req.body.fullName,
          image: req.body.image,
          imageId: req.body.imageId,
        });
        User.register(newUser, req.body.password, function (err, user) {
          if (err) {
            return res.render("register", {
              error: err.message,
            });
          }
          passport.authenticate("local")(req, res, function () {
            res.redirect("/campgrounds");
          });
        });
      },
      {
        moderation: "webpurify",
      }
    );
  }
});

// show login form
router.get("/login", function (req, res) {
  if (req.user) {
    return res.redirect("/campgrounds");
  } else {
    res.render("login");
  }
});

// handle login logic
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (req, res) {}
);

// logout route
router.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
  });
  res.redirect("/");
});

// user profile
router.get("/users/:user_id", function (req, res) {
  User.findById(req.params.user_id, function (err, foundUser) {
    if (err || !foundUser) {
      req.flash("error", "This user doesn't exist");
      return res.render("error");
    }
    Campground.find()
      .where("author.id")
      .equals(foundUser._id)
      .exec(function (err, campgrounds) {
        if (err) {
          req.flash("error", "Something went wrong");
          res.render("error");
        }
        Comment.find()
          .where("author.id")
          .equals(foundUser._id)
          .exec(function (err, ratedCount) {
            if (err) {
              req.flash("error", "Something went wrong");
              res.render("error");
            }
            res.render("users/show", {
              user: foundUser,
              campgrounds: campgrounds,
              reviews: ratedCount,
            });
          });
      });
  });
});

// edit profile
router.get(
  "/users/:user_id/edit",
  middleware.isLoggedIn,
  middleware.checkProfileOwnership,
  function (req, res) {
    res.render("users/edit", {
      user: req.user,
    });
  }
);

// update profile
router.patch(
  "/users/:user_id",
  upload.single("image"),
  middleware.checkProfileOwnership,
  function (req, res) {
    User.findById(req.params.user_id, async function (err, user) {
      if (err) {
        req.flash("error", err.message);
      } else {
        if (req.file) {
          try {
            if (user.imageId) await cloudinary.uploader.destroy(user.imageId);
            const result = await cloudinary.uploader.upload(req.file.path, {
              width: 400,
              height: 400,
              gravity: "center",
              crop: "scale",
            });
            user.imageId = result.public_id;
            user.image = result.secure_url;
          } catch (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
        }
        user.email = req.body.email;
        user.phone = req.body.phone;
        user.fullName = req.body.fullName;
        user.save();
        req.flash("success", "Updated your profile!");
        res.redirect("/users/" + req.params.user_id);
      }
    });
  }
);

// delete user
router.delete(
  "/users/:user_id",
  middleware.checkProfileOwnership,
  function (req, res) {
    User.findById(req.params.user_id, async function (err, user) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      if (user.image === "") {
        user.remove();
        res.redirect("/");
      } else {
        try {
          await cloudinary.uploader.destroy(user.imageId);
          user.remove();
          res.redirect("/");
        } catch (err) {
          if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
        }
      }
    });
  }
);

module.exports = router;
