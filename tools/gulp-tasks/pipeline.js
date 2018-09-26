module.exports = (gulp, $, config) => {
  return () => {
    let stream;

    if (config.src) {
      stream = gulp.src(config.src, config.opt);
    }

    if (config.pipelines) {
      config.pipelines.forEach((item) => {
        let f;
        if (item.src) {
          f = $.filter(item.src, item.opt);
          stream = stream.pipe(f);
        }

        item.do.forEach((fn) => {
          if (!stream) {
            stream = fn();
          } else {
            stream = stream.pipe(fn);
          }
        });

        if (item.src) {
          stream = stream.pipe(f.restore);
        }
      });
    }

    if (config.dist) {
      stream = stream.pipe(gulp.dest('./dist'));
    }

    return stream;
  };
};
