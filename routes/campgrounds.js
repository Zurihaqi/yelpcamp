const express = require("express");
const router = express.Router();
const Campground = require("../models/campground");
const middleware = require("../middleware");
const NodeGeocoder = require("node-geocoder");
const options = {
  provider: "opencage",
  httpAdapter: "https",
  apiKey: process.env.GEO_CODE_API,
  formatter: null,
};
const geocoder = NodeGeocoder(options);
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
  secure: true,
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const Fuse = require("fuse.js");

// INDEX - show all campgrounds
router.get("/", function (req, res) {
  const noMatch = null;
  if (req.query.search) {
    Campground.find({}, function (err, allCampgrounds) {
      if (err) {
        console.log(err);
      } else {
        const options = {
          shouldSort: true,
          threshold: 0.5,
          location: 0,
          distance: 100,
          maxPatternLength: 32,
          minMatchCharLength: 2,
          keys: ["name", "location"],
        };
        const fuse = new Fuse(allCampgrounds, options);
        const result = fuse.search(req.query.search);
        if (result.length < 1) {
          noMatch = req.query.search;
        }
        res.render("campgrounds/index", {
          campgrounds: result,
          noMatch: noMatch,
        });
      }
    });
  } else if (req.query.sortby) {
    if (req.query.sortby === "rateAvg") {
      Campground.find({})
        .sort({
          rateCount: -1,
          rateAvg: -1,
        })
        .exec(function (err, allCampgrounds) {
          if (err) {
            console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              currentUser: req.user,
              noMatch: noMatch,
            });
          }
        });
    } else if (req.query.sortby === "rateCount") {
      Campground.find({})
        .sort({
          rateCount: -1,
        })
        .exec(function (err, allCampgrounds) {
          if (err) {
            console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              currentUser: req.user,
              noMatch: noMatch,
            });
          }
        });
    } else if (req.query.sortby === "priceLow") {
      Campground.find({})
        .sort({
          price: 1,
          rateAvg: -1,
        })
        .exec(function (err, allCampgrounds) {
          if (err) {
            console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              currentUser: req.user,
              noMatch: noMatch,
            });
          }
        });
    } else {
      Campground.find({})
        .sort({
          price: -1,
          rateAvg: -1,
        })
        .exec(function (err, allCampgrounds) {
          if (err) {
            console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              currentUser: req.user,
              noMatch: noMatch,
            });
          }
        });
    }
  } else {
    Campground.find({}, function (err, allCampgrounds) {
      if (err) {
        console.log(err);
      } else {
        res.render("campgrounds/index", {
          campgrounds: allCampgrounds,
          currentUser: req.user,
          noMatch: noMatch,
        });
      }
    });
  }
});

// CREATE - add new campground to db
router.post(
  "/",
  middleware.isLoggedIn,
  upload.single("image"),
  function (req, res) {
    cloudinary.uploader.upload(
      req.file.path,
      {
        width: 1500,
        height: 1000,
        crop: "scale",
      },
      function (err, result) {
        if (err) {
          req.flash("error", err.message);
          return res.render("error");
        }
        req.body.campground.image = result.secure_url;
        req.body.campground.imageId = result.public_id;
        req.body.campground.booking = {
          start: req.body.campground.start,
          end: req.body.campground.end,
        };
        req.body.campground.tags = req.body.campground.tags.split(",");
        req.body.campground.author = {
          id: req.user._id,
          username: req.user.username,
        };
        geocoder.geocode(req.body.campground.location, function (err, data) {
          if (err || !data.length) {
            console.log(err);
            req.flash("error", "Invalid address");
            return res.redirect("back");
          }
          req.body.campground.lat = data[0].latitude;
          req.body.campground.lng = data[0].longitude;
          req.body.campground.location = req.body.campground.location;

          Campground.create(req.body.campground, function (err, campground) {
            if (err) {
              req.flash("error", err.message);
              return res.render("error");
            }
            res.redirect("/campgrounds");
          });
        });
      },
      {
        moderation: "webpurify",
      }
    );
  }
);

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function (req, res) {
  res.render("campgrounds/new");
});

// SHOW - shows more information about one campground
router.get("/:id", function (req, res) {
  Campground.findById(req.params.id)
    .populate("comments")
    .exec(function (err, foundCampground) {
      if (err || !foundCampground) {
        console.log(err);
        req.flash("error", "Sorry, that campground does not exist!");
        return res.render("error");
      }
      const ratingsArray = [];

      foundCampground.comments.forEach(function (rating) {
        ratingsArray.push(rating.rating);
      });
      if (ratingsArray.length === 0) {
        foundCampground.rateAvg = 0;
      } else {
        const ratings = ratingsArray.reduce(function (total, rating) {
          return total + rating;
        });
        foundCampground.rateAvg = ratings / foundCampground.comments.length;
        foundCampground.rateCount = foundCampground.comments.length;
      }
      foundCampground.save();
      res.render("campgrounds/show", {
        campground: foundCampground,
      });
    });
});

// EDIT CAMPGROUND ROUTE
router.get(
  "/:id/edit",
  middleware.isLoggedIn,
  middleware.checkCampgroundOwnership,
  function (req, res) {
    res.render("campgrounds/edit", {
      campground: req.campground,
    });
  }
);

// UPDATE CAMPGROUND ROUTE
router.patch(
  "/:id",
  upload.single("image"),
  middleware.checkCampgroundOwnership,
  function (req, res) {
    geocoder.geocode(req.body.campground.location, function (err, data) {
      if (err || !data.length) {
        req.flash("error", "Invalid address");
        return res.redirect("back");
      }
      console.log(data[0]);
      req.body.campground.lat = data[0].latitude;
      req.body.campground.lng = data[0].longitude;
      req.body.campground.location = req.body.campground.location;
      req.body.campground.booking = {
        start: req.body.campground.start,
        end: req.body.campground.end,
      };
      req.body.campground.tags = req.body.campground.tags.split(",");
      Campground.findByIdAndUpdate(
        req.params.id,
        req.body.campground,
        async function (err, campground) {
          if (err) {
            req.flash("error", err.message);
            res.redirect("back");
          } else {
            if (req.file) {
              try {
                await cloudinary.uploader.destroy(campground.imageId);
                const result = await cloudinary.uploader.upload(req.file.path, {
                  width: 1500,
                  height: 1000,
                  crop: "scale",
                });
                campground.imageId = result.public_id;
                campground.image = result.secure_url;
              } catch (err) {
                req.flash("error", err.message);
                return res.render("error");
              }
            }
            campground.save();
            req.flash("success", "Successfully updated your campground!");
            res.redirect("/campgrounds/" + req.params.id);
          }
        }
      );
    });
  }
);

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, function (req, res) {
  Campground.findById(req.params.id, async function (err, campground) {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("back");
    }
    try {
      await cloudinary.uploader.destroy(campground.imageId);
      campground.remove();
      res.redirect("/campgrounds");
    } catch (err) {
      if (err) {
        req.flash("error", err.message);
        return res.render("error");
      }
    }
  });
});

module.exports = router;
