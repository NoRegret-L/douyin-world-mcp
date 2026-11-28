if (process.argv[2] === 'large-fixture') {
  process.stdout.write('汉字'.repeat(12000) + 'NEEDLE' + '尾');
  process.stderr.write('diagnostic');
} else {
  process.stdout.write(JSON.stringify(process.argv.slice(2)));
}
