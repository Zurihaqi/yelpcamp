var stars = [
  '<i class="far fa-star text-danger"></i>',
  '<i class="far fa-star text-danger"></i>',
  '<i class="far fa-star text-danger"></i>',
  '<i class="far fa-star text-danger"></i>',
  '<i class= "far fa-star text-danger" ></i> ',
];
for (var i = 0; i < Math.round(campground.rateAvg); i++) {
  stars[i] = '<i class="fas fa-star text-danger"></i>';
}
for (var i = 0; i < stars.length; i++) {
  -stars[i];
}
if (campground.comments.length === 1) {
  <span class="text-muted">= campground.comments.length Review</span>;
} else {
  <span class="text-muted">= campground.comments.length Reviews</span>;
}
