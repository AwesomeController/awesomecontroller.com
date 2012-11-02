$(function() {
  var lastScrollTop = 0;
  $(window).scroll(function() {
    var documentScrollTop = $(document).scrollTop();
      if (documentScrollTop !== 0) {
          window.scrollTo(documentScrollTop * 1.5 + $(document).scrollLeft(), 0);
      }
  });
});
