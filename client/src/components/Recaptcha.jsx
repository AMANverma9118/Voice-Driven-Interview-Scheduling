import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const Recaptcha = forwardRef(function Recaptcha({ siteKey, onToken }, ref) {
  const host = useRef(null);
  const widget = useRef(null);
  const tokenCb = useRef(onToken);
  tokenCb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      tokenCb.current("");
      if (widget.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widget.current);
      }
    },
  }));

  useEffect(() => {
    if (!siteKey || !host.current) return undefined;
    let cancelled = false;

    function render() {
      if (cancelled || !host.current || widget.current !== null || !window.grecaptcha?.render) return;
      widget.current = window.grecaptcha.render(host.current, {
        sitekey: siteKey,
        callback: (token) => tokenCb.current(token),
        "expired-callback": () => tokenCb.current(""),
      });
    }

    if (window.grecaptcha?.render) {
      window.grecaptcha.ready(render);
    } else {
      let script = document.querySelector("script[data-recaptcha]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
        script.async = true;
        script.dataset.recaptcha = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", () => window.grecaptcha.ready(render));
      if (window.grecaptcha) window.grecaptcha.ready(render);
    }

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  if (!siteKey) {
    return <p className="banner">Add a reCAPTCHA site key on the server before accounts can be created.</p>;
  }

  return <div ref={host} className="captcha" />;
});

export default Recaptcha;
