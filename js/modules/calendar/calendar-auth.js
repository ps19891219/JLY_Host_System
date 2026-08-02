(function () {
  "use strict";

  let tokenClient = null;

  let accessToken = "";

  let tokenExpiresAt = 0;

  function getConfig() {
    return (
      window.JLYCalendarConfig ||
      {}
    );
  }

  function isConfigured() {
    const clientId = String(
      getConfig().googleClientId ||
      ""
    ).trim();

    return Boolean(
      clientId &&
      !clientId.includes(
        "請填入"
      ) &&
      !clientId.includes(
        "YOUR_"
      )
    );
  }

  function isGoogleLibraryReady() {
    return Boolean(
      window.google &&
      google.accounts &&
      google.accounts.oauth2
    );
  }

  function hasUsableToken() {
    return Boolean(
      accessToken &&
      Date.now() <
        tokenExpiresAt - 30000
    );
  }

  function init() {
    if (!isConfigured()) {
      throw new Error(
        "尚未設定 Google OAuth Client ID"
      );
    }

    if (!isGoogleLibraryReady()) {
      throw new Error(
        "Google Identity Services 尚未載入"
      );
    }

    if (tokenClient) {
      return tokenClient;
    }

    tokenClient =
      google.accounts.oauth2
        .initTokenClient({
          client_id:
            getConfig().googleClientId,

          scope:
            getConfig().scopes,

          callback: function () {}
        });

    return tokenClient;
  }

  function requestAccessToken(
    options = {}
  ) {
    if (
      hasUsableToken() &&
      options.force !== true
    ) {
      return Promise.resolve(
        accessToken
      );
    }

    const client = init();

    return new Promise(
      function (
        resolve,
        reject
      ) {
        client.callback =
          function (response) {
            if (
              !response ||
              response.error
            ) {
              reject(
                new Error(
                  response &&
                  response
                    .error_description
                    ? response
                        .error_description
                    : response &&
                        response.error
                      ? response.error
                      : "Google 授權失敗"
                )
              );

              return;
            }

            accessToken =
              response.access_token ||
              "";

            const expiresIn =
              Number(
                response.expires_in ||
                3600
              );

            tokenExpiresAt =
              Date.now() +
              expiresIn * 1000;

            if (!accessToken) {
              reject(
                new Error(
                  "Google 沒有回傳 Access Token"
                )
              );

              return;
            }

            resolve(accessToken);
          };

        client.error_callback =
          function (error) {
            reject(
              new Error(
                error &&
                error.message
                  ? error.message
                  : "Google 授權視窗未完成"
              )
            );
          };

        client.requestAccessToken({
          prompt:
            options.force === true
              ? "consent"
              : ""
        });
      }
    );
  }

  function getAccessToken() {
    return hasUsableToken()
      ? accessToken
      : "";
  }

  function clearToken() {
    accessToken = "";

    tokenExpiresAt = 0;
  }

  window.JLYCalendarAuth = {
    init,
    isConfigured,
    hasUsableToken,
    requestAccessToken,
    getAccessToken,
    clearToken
  };
})();