const mrktInputValueUpdate = (paramObject) => {
  const utmFiltered = Object.fromEntries(
    Object.entries(paramObject).filter(([key]) => key.toLowerCase().startsWith('utm_') || key.toLowerCase() === 'gclid')
  );

  // MktoForms2の読み込みを待つポーリング処理関数
  const pollMktoForms2 = (callback, interval = 200, maxAttempts = 50) => {
    let attempts = 0;
    const timer = setInterval(() => {
      // ライブラリ本体が存在するかチェック
      if (window.MktoForms2) {
        clearInterval(timer);
        callback();
      } else if (++attempts >= maxAttempts) {
        clearInterval(timer);
        console.warn('MktoForms2 is undifined');
      }
    }, interval);
  };

  pollMktoForms2(() => {
    // 既存のフォームがあれば即座に、これから生成されるものには準備ができ次第実行
    window.MktoForms2.whenReady((form) => {
      // utmFilteredのkeyの先頭に「PMCF_」か,末尾に「__c」をつけてセット
      const utmValuesToSet = {};
      Object.entries(utmFiltered).forEach(([key, value]) => {
        utmValuesToSet[`PMCF_${key}`] = value;
        utmValuesToSet[`${key}__c`] = value;
      });
      form.setValues(utmValuesToSet);
    });
  });
};
const UtmParameterControl = () => {
  // すでに完了しているなら何もしない（グローバル変数は適宜定義してください）
  if (window.__fr__utmTaskCompleted === true) return;

  // eslint-disable-next-line compat/compat
  const params = new URLSearchParams(window.location.search);
  const currentTime = Date.now();
  const hasUtmParamOriginal = [...params.keys()].some((key) => key.startsWith('utm_'));
  let hasUtmParam = hasUtmParamOriginal;
  const hasRequiredUtm = params.has('utm_source') && params.has('utm_medium');

  // オーガニック検索流入の判定とパラメータ追加処理
  if (!hasRequiredUtm && document.referrer) {
    try {
      const referrerUrl = new URL(document.referrer);
      const host = referrerUrl.hostname.toLowerCase();

      const organicList = [
        'google.com',
        'google.co.jp',
        'yahoo.co.jp',
        'yahoo.com',
        'bing.com',
        'biglobe.ne.jp',
        'goo.ne.jp',
        'duckduckgo.com',
        'ecosia.org',
        'yandex.ru',
        'naver.com',
        'baidu.com',
        'so.com',
        'ask.com'
      ];

      // リファラーが指定のオーガニック検索エンジンに該当するかチェック
      const matchedDomain = organicList.find((domain) => host.includes(domain));

      if (matchedDomain) {
        // ドメインの最初のドットより前を抽出してGA4準拠のsource名とする（例: 'google', 'yahoo'）
        const detectedSource = matchedDomain.split('.')[0];

        params.set('utm_source', detectedSource);
        params.set('utm_medium', 'organic');
        hasUtmParam = true; // 新たにパラメータを付与したため保存対象とする

        let queryString = params.toString();
        queryString = queryString.replace(/=(?=&|$)/g, ''); // 値が空のパラメータを「key=」から「key」に変換
        const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}${window.location.hash}`;
        history.replaceState(null, '', newUrl);
      }
    } catch (e) {
      console.error('Referrer parse error:', e);
    }
  }

  // 1. UTMがある場合は保存
  if (hasUtmParam) {
    try {
      localStorage.setItem(
        'last_utm_query',
        JSON.stringify({
          time: currentTime,
          query: Object.fromEntries(params)
        })
      );
    } catch (e) {
      console.warn('localStorage is not available:', e);
    }
  }

  // 2. 復元が必要かチェック
  let rawData = null;
  try {
    rawData = localStorage.getItem('last_utm_query');
  } catch (e) {
    console.warn('localStorage read blocked:', e);
  }

  let savedQuery = null;
  let isExpired = true;

  if (rawData) {
    const parsed = JSON.parse(rawData);
    savedQuery = parsed.query;
    isExpired = currentTime - parsed.time >= 1 * 864e5; // 1日
  }

  // localStorageが使えない環境向けにdocument.referrerからパラメータを救済する処理
  if (!savedQuery && document.referrer) {
    try {
      const referrerUrl = new URL(document.referrer);
      // 同一ホスト間での遷移であり、遷移元URLにUTMパラメータがある場合はデータを救済
      if (referrerUrl.hostname === window.location.hostname) {
        const referrerParams = Object.fromEntries(referrerUrl.searchParams);
        const hasReferrerUtm = Object.keys(referrerParams).some((key) => key.startsWith('utm_'));
        if (hasReferrerUtm) {
          savedQuery = referrerParams;
          isExpired = false; // 同一セッション内のため期限切れとしない
        }
      }
    } catch (e) {
      console.error('Referrer rescue process error:', e);
    }
  }

  const hasMrktoFormDom = document.querySelector("form[id*='mktoForm_']");

  // 復元条件に合致しない場合は終了
  if (!hasMrktoFormDom || isExpired || (!savedQuery && !hasUtmParamOriginal)) return;

  // 3. 実際の復元処理
  if (!hasUtmParamOriginal && savedQuery) {
    const utmEntries = Object.entries(savedQuery).filter(
      ([key]) => key.toLowerCase().startsWith('utm_') || key.toLowerCase() === 'gclid'
    ); // utm_から始まるパラメータとgclidを復元対象に追加

    if (utmEntries.length > 0) {
      utmEntries.forEach(([key, value]) => params.set(key, value));
      params.set('restored', currentTime);

      let queryString = params.toString();
      queryString = queryString.replace(/=(?=&|$)/g, ''); // 値が空のパラメータを「key=」から「key」に変換
      const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}${window.location.hash}`;

      history.replaceState(null, '', newUrl);
      window.__fr__utmTaskCompleted = true; // 完了フラグを立てる

      try {
        localStorage.setItem(
          'last_utm_query',
          JSON.stringify({
            time: currentTime,
            query: Object.fromEntries(params)
          })
        );
      } catch (e) {
        console.warn('localStorage is not available:', e);
      }
    }
  }

  // フォームへの値セットを実行
  mrktInputValueUpdate(Object.fromEntries(params));
};

const setURLParameter = (url, paramName, paramValue) => {
  let anchor = '';
  if (url.indexOf('#') >= 0) {
    anchor = url.substring(url.indexOf('#'));
    url = url.substring(0, url.indexOf('#'));
  }
  if (url.indexOf('?') == -1) {
    return paramValue !== null ? url + '?' + paramName + '=' + paramValue + anchor : url + '?' + paramName + anchor;
  } else {
    return paramValue !== null ? url + '&' + paramName + '=' + paramValue + anchor : url + '&' + paramName + anchor;
  }
};
const catchLastLp = () => {
  // eslint-disable-next-line compat/compat
  const currentLocation = new URL(window.location.href);
  const getParamsValue = currentLocation.searchParams;
  const getParamsString = currentLocation.search;

  const pageDirectory = location.pathname;

  const formatPageDirectory = pageDirectory.replace(/\//g, '_').replace(/#/g, '').replace(/:/g, '').slice(0, -1);
  const lastLpId = '__' + formatPageDirectory;

  const isReferral = getParamsString.includes('referral');
  const isAdvisorReferral3 = getParamsString.includes('advisorReferral3');
  const isAfSub = getParamsString.includes('af_sub1');

  const aTag = document.querySelectorAll('a');
  aTag.forEach((element) => {
    let hrefInPage = element.getAttribute('href');
    const loginURLRegex = /accounts\.secure\.freee\.co\.jp\/sessions\/new/;

    if (hrefInPage) {
      if (/last_lp/.test(hrefInPage)) return; // すでにlast_lpが付与されているなら抜ける
      if (loginURLRegex.test(hrefInPage)) return; // loginURLなら抜ける
      if (/secure\.freee\.co\.jp/.test(hrefInPage)) {
        hrefInPage = setURLParameter(hrefInPage, 'last_lp', lastLpId);
      }
      if (
        !((hrefInPage.startsWith('http') || hrefInPage.startsWith('//')) && !hrefInPage.includes('www.freee.co.jp')) ||
        /secure\.freee\.co\.jp/.test(hrefInPage)
      ) {
        if (isReferral) {
          const referralValue = getParamsValue.get('referral');
          hrefInPage = setURLParameter(hrefInPage, 'referral', referralValue);
        }
        if (isAdvisorReferral3) {
          const advisorReferral3Value = getParamsValue.get('advisorReferral3');
          hrefInPage = setURLParameter(hrefInPage, 'advisorReferral3', advisorReferral3Value);
        }
        if (isAfSub) {
          const AfSubValue = getParamsValue.get('af_sub1');
          hrefInPage = setURLParameter(hrefInPage, 'af_sub1', AfSubValue);
        }
      }
      element.setAttribute('href', hrefInPage);
    }
  });
};

UtmParameterControl();

catchLastLp();
