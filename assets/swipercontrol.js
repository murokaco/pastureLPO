// swiperのjsを初期化して、設定を追加してる
// lintさせる意味ないので、外してる
/* eslint-disable @typescript-eslint/no-unused-vars */
const swiperWraps = document.querySelectorAll('.swiper');

if (swiperWraps.length > 0) {
  Array.from(swiperWraps).map((item, index) => {
    item.classList.add(`swiper_multi${index}`);
    // eslint-disable-next-line no-undef
    const swiper = new Swiper(`.swiper_multi${index}`, {
      slidesPerView: 1,
      breakpoints: {
        // 768px以上の場合
        768: {
          slidesPerGroup: 3,
          slidesPerView: 3,
          spaceBetween: 30
        }
      },
      pagination: {
        el: `.swiper_multi${index} .swiper-pagination`
      },
      navigation: {
        nextEl: `.swiper_multi${index} .swiper-button-next`,
        prevEl: `.swiper_multi${index} .swiper-button-prev`
      },
      a11y: {
        prevSlideMessage: '前へ',
        nextSlideMessage: '次へ'
      }
    });

    /**
     * PC幅でitemが3個以下のときにc-carousel_footerを表示させない
     */
    if (window.matchMedia('(min-width: 768px)').matches) {
      const swiperNavs = document.querySelectorAll('.display-lg-swiper-footer');
      if (swiperNavs.length > 0) {
        Array.from(swiperNavs).map((item) => {
          const swipeWrapper = item.parentElement.previousElementSibling.classList.contains('display-lg-swiper-wrap')
            ? item.parentElement.previousElementSibling
            : null;
          if (swipeWrapper && swipeWrapper.querySelectorAll('.feature_slide_banner').length <= 3) {
            item.style.display = 'none';
          }
        });
      }
    }
  });
}
