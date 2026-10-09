import { SKINS, HAIRS, GARMENT_COLORS } from '../avatar/model.js';
import { ILLUSTRATED_PALETTE } from './inventory.js';

const { ink, paper } = ILLUSTRATED_PALETTE;
const p = (d, fill = 'none', attrs = '') => `<path d="${d}" fill="${fill}" ${attrs}/>`;
const line = d => p(d, 'none', 'stroke-width="1.45"');
const circle = (x, y, r, fill, attrs = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${attrs}/>`;
const layer = (name, value, content) => `<g data-layer="${name}" data-part="${value}">${content}</g>`;
const shade = (d, opacity = '.11') => p(d, ink, `stroke="none" opacity="${opacity}"`);

function legs(a, side, back) {
  const skin = SKINS[a.skin], sock = a.bottom === 3;
  if (side) return layer('legs', 'side', p('M106 265 137 267 130 340 145 398 142 452 130 452 128 402 109 346Z', skin) + p('M122 270 149 269 143 351 121 403 113 450 99 449 104 400 121 344Z', skin) + shade('M130 294 143 279 137 349 115 404 106 444 104 400 121 344Z') + (sock ? p('M127 408 143 409 142 451 129 451ZM105 412 120 415 113 451 99 449Z', paper) + line('M133 416 134 443M113 421 106 443') : '') + line('M105 445 113 446M132 447 141 447'));
  return layer('legs', back ? 'back' : 'front', p('M87 263 116 268 111 336 101 380 93 449 78 449 83 377 87 333Z', skin) + p('M120 265 150 262 148 342 137 393 139 451 123 452 120 392 129 339Z', skin) + shade('M108 282 115 272 109 339 98 382 87 444 84 379 94 336Z') + shade('M141 288 150 272 148 342 137 393 135 442 129 394 137 340Z') + (sock ? p('M82 399 99 402 93 451 78 451ZM120 405 138 403 139 452 123 452Z', paper) + line('M88 409 84 440M92 410 88 440M127 412 128 443M132 411 133 443') : '') + line('M80 444 94 445M124 446 137 445'));
}

function bottoms(a, side, back) {
  const color = GARMENT_COLORS[a.bottomColor];
  const paths = side ? [
    'M102 252 150 251 153 295 131 302 124 285 117 300 100 293Z',
    'M103 251 150 251 148 337 127 399 116 449 96 446 103 399 123 337 120 287 125 344 145 398 146 450 125 452 124 408 106 350Z',
    'M101 253 151 250 153 336 165 449 132 457 119 390 120 339 127 297 122 341 103 450 74 449 99 338Z',
    'M102 252 150 251 153 296 131 304 124 285 117 302 100 295Z',
    'M104 252 147 252 145 337 121 400 116 452 98 450 106 397 125 336 121 285 128 347 146 399 145 452 130 452 127 402 109 347Z',
    'M103 253 151 251 142 347 145 390 165 454 130 462 118 390 123 344 126 287 122 341 111 389 108 457 72 451 97 388 105 340Z',
  ] : [
    'M84 251 148 250 156 299 122 309 117 284 113 310 76 301Z',
    'M83 252 147 251 149 335 134 389 146 447 121 455 114 394 124 335 117 284 109 337 93 389 93 449 70 449 76 385 82 331Z',
    'M82 251 150 251 158 344 158 455 118 459 114 354 118 290 111 343 101 455 62 451 80 343Z',
    'M84 251 148 250 156 302 122 312 117 286 113 312 76 304Z',
    'M85 251 146 251 144 337 132 389 144 451 122 455 116 391 126 336 116 285 107 337 94 389 92 451 73 448 80 384 86 332Z',
    'M83 251 149 251 145 338 141 389 161 452 121 459 116 391 125 337 116 284 106 338 99 388 99 456 59 451 80 382 84 335Z',
  ];
  const short = a.bottom === 0 || a.bottom === 3;
  let details = side ? line(`M108 265 145 264M129 265 128 282M108 270 115 280M142 268 137 284`) : line('M88 265Q117 270 147 263M117 269 117 284M91 269 89 283M138 267 141 282');
  if (back) details += p(side ? 'M123 272 137 271 136 286 125 286Z' : 'M91 273 108 275 107 290 91 287ZM129 274 145 271 147 286 130 290Z', 'none', 'stroke-width="1.3"');
  else details += line(side ? 'M111 267 109 280 103 284' : 'M86 268 94 272 84 286M144 267 137 273 151 284');
  if (!short) details += side ? line('M139 313 133 341 121 374M108 398 116 407M134 426 144 439M101 442 111 445') : line('M101 311 96 343 86 372M136 316 130 348M124 392 134 415M77 439 88 443M123 448 141 443');
  else details += line(side ? 'M103 289 114 293M135 295 150 289' : 'M81 294 109 302M126 301 149 295');
  const fold = short ? (side ? 'M126 271 128 296 133 300 133 280Z' : 'M116 269 126 301 122 306 118 287 112 305 109 303Z') : (side ? 'M124 280 132 336 119 393 113 435 105 441 113 391 123 335Z' : 'M117 280 128 334 119 390 128 442 121 450 113 393 122 335 116 299 106 340 84 408 91 389 112 326Z');
  return layer('bottom', a.bottom, p(paths[a.bottom], color) + shade(fold, '.17') + details + p(side ? 'M137 256h7v9h-7Z' : 'M126 255h8v10h-8Z', '#b79b68', 'stroke-width="1"'));
}

function shoes(a, side, back) {
  const color = GARMENT_COLORS[a.shoeColor];
  const xforms = side ? ['translate(19 -1)', 'translate(46 1)'] : ['', 'translate(48 2)'];
  // Two asymmetric shoes, each anchored to the matching ankle. The sole remains grounded at y477.
  return layer('shoes', a.shoes, xforms.map((t, i) => {
    const mirrored = !side && i === 1;
    let body = '', detail = '';
    if (a.shoes === 0) { body = p('M78 441 94 442 99 455 112 463 113 474 67 474 66 467Z', color); detail = p('M99 455Q112 457 113 466L92 466Z', paper) + line('M77 450 91 453M75 455 89 458M73 460 87 463'); }
    if (a.shoes === 1) { body = p('M77 425 94 426 97 452 110 461 113 473 66 474 66 466 73 451Z', color); detail = p('M77 426 94 426 93 434 77 433Z', paper) + p('M95 454Q110 456 112 466L89 466Z', paper) + line('M79 438 90 440M77 444 90 446M76 450 89 452M73 456 87 458') + circle(72, 447, 3.3, paper, 'stroke-width="1.2"'); }
    if (a.shoes === 2) { body = p('M76 447Q84 439 94 447L98 457Q110 456 114 465L113 474 65 474 66 462Z', color); detail = p('M77 450 96 452 100 461 73 459Z', color) + p('M82 453h10v4H81Z', '#b79b68', 'stroke-width="1"') + line('M70 464Q91 469 110 463'); }
    if (a.shoes === 3) { body = p('M77 435 95 437 97 451 112 459 115 469 113 478 64 478 64 465 70 452Z', color); detail = p('M97 452Q112 455 114 464L89 464Z', paper) + line('M77 444 91 446M75 450 89 452M72 456 87 458'); }
    const sole = p(a.shoes === 3 ? 'M64 464Q88 470 115 464L114 478 64 478Z' : 'M66 466Q89 469 113 466L113 475 66 475Z', a.shoes === 2 ? ink : paper, 'stroke-width="1.8"') + line(a.shoes === 3 ? 'M68 472 109 473' : 'M70 471 109 472');
    return `<g transform="${t}${mirrored ? ' translate(175 0) scale(-1 1)' : ''}">${body}${back ? line('M82 445 83 465') : detail}${sole}</g>`;
  }).join(''));
}

function arms(a, side, back) {
  const skin = SKINS[a.skin];
  if (a.pose === 'wave') {
    const hand = p('M24 176 18 158 19 143Q20 139 22 142L25 153 24 136Q26 132 28 136L31 151 33 136Q36 133 37 138L37 154 40 146Q43 144 44 148L39 166 36 174Z',skin) + line('M24 158 31 164 32 169M31 153 35 157');
    const arm = p('M70 180 84 191 61 232Q49 246 39 229L19 177 35 168 52 209 60 187Z',skin) + shade('M52 208 59 224 51 232 44 226 26 178 32 176Z');
    const rest = side ? p('M145 182 157 186 159 243 150 283 146 290 139 285 146 277 148 240Z',skin) : p('M146 178 160 181 164 229 159 269 156 282 149 287 143 281 146 269 148 230Z',skin);
    return layer('arms','wave',`<g transform="${side?'translate(22 0)':''}">${hand}${arm}</g>`+rest);
  }
  if (a.pose === 'sing') {
    const left = side ? p('M117 178 133 180 124 236 147 273 141 288 132 285 132 277 109 243 108 223Z',skin) : p('M72 177 86 187 73 236 91 273 84 282 77 278 60 242 61 225Z',skin);
    const right = p('M147 181 160 186 176 218 179 212 163 165 159 158 159 148 166 141 174 144 178 155 176 164 193 218Q192 234 178 237L165 232 145 200Z',skin) + line('M164 150 172 153M163 156 171 158M165 162 172 165');
    return layer('arms','sing',left+right);
  }
  if (side) return layer('arms', 'side', p('M117 178 133 180 124 236 147 273 141 288 132 285 132 277 109 243 108 223Z', skin) + p('M145 182 157 186 159 243 150 283 146 290 139 285 146 277 148 240Z', skin) + line('M138 277 143 282M145 278 148 280'));
  return layer('arms', back ? 'back' : 'front', p('M72 177 86 187 73 236 91 273 84 282 77 278 60 242 61 225Z', skin) + p('M146 178 160 181 164 229 159 269 156 282 149 287 143 281 146 269 148 230Z', skin) + shade('M156 197 161 217 160 240 153 270 150 280 149 273 154 230Z') + line('M147 274 145 281M152 273 151 282M79 269 86 275'));
}

function tops(a, side, back, quarter = false) {
  const color = GARMENT_COLORS[a.topColor], neck = SKINS[a.skin];
  const frontShapes = [
    'M95 154 109 158 124 153 145 160 160 201 143 211 137 194 145 263 121 274 82 263 82 205 74 214 54 203 68 165Z',
    'M94 150 111 157 126 151 149 159 166 219 156 260 139 268 137 242 143 270 82 270 79 246 72 267 55 250 57 213 68 163Z',
    'M95 154 111 158 125 152 144 160 157 189 156 237 162 263 141 270 137 201 137 261 85 263 83 202 78 267 56 261 63 230 60 192 72 164Z',
    'M95 152 110 157 125 152 149 159 161 192 170 237 162 260 142 269 137 249 138 271 82 271 82 250 73 265 54 252 55 226 66 167Z',
    'M94 156 109 160 125 153 145 162 155 193 167 256 144 268 133 206 142 266 111 275 82 265 83 211 72 250 58 259 45 240 62 181 70 165Z',
    'M99 153 110 160 124 153 141 163 137 220 129 236 87 231 82 213 85 167Z',
  ];
  const sideShapes = [
    'M113 153 130 156 143 153 158 167 166 208 149 213 146 197 149 263 119 272 96 258 103 202 96 212 85 200 99 165Z',
    'M110 151 127 156 144 152 159 165 173 220 158 269 138 266 143 240 150 271 104 268 105 238 98 265 81 251 92 193 99 165Z',
    'M112 154 129 157 143 154 156 164 168 205 158 260 138 266 146 205 147 263 101 267 105 205 98 266 79 261 91 204 99 165Z',
    'M112 152 128 157 144 152 159 166 174 224 160 268 140 269 144 246 148 272 105 271 105 245 97 267 79 256 90 204 99 165Z',
    'M112 156 129 159 143 154 159 167 165 207 174 257 152 267 141 204 150 266 120 274 100 263 103 211 92 254 76 248 91 198 99 167Z',
    'M114 155 131 160 144 155 155 166 151 208 147 233 106 235 100 212 102 167Z',
  ];
  const quarterShapes = [
    'M102 154 117 158 130 154 146 163 159 202 145 211 139 196 147 263 123 272 88 260 86 204 77 213 57 201 72 165Z',
    'M102 151 117 158 131 153 149 162 166 219 156 260 142 268 139 242 146 269 88 267 84 244 76 265 58 249 60 212 73 164Z',
    'M102 154 117 159 130 153 146 163 158 191 155 238 163 263 143 269 138 202 141 261 89 262 87 202 81 265 61 258 66 229 63 192 75 165Z',
    'M102 153 117 158 130 153 148 162 161 194 169 237 162 260 145 268 140 250 142 270 89 270 85 250 78 264 59 251 59 226 74 166Z',
    'M102 156 117 160 130 154 146 164 155 194 167 256 146 268 136 208 145 265 118 273 88 263 87 211 77 249 62 257 51 240 67 182 75 165Z',
    'M104 154 117 161 130 154 145 165 139 220 132 235 94 231 87 213 90 167Z',
  ];
  let shape = (side ? sideShapes : quarter ? quarterShapes : frontShapes)[a.top];
  if (a.pose === 'wave' && [1,2,3,4].includes(a.top)) {
    shape = side
      ? 'M112 153 128 157 144 153 159 166 174 224 160 268 140 269 144 246 148 272 105 270 103 231 83 243 65 236 40 178 59 166 80 205 92 185 99 166Z'
      : 'M98 153 113 158 128 153 149 162 165 216 161 260 142 269 137 245 143 270 87 268 82 229 65 243 46 237 18 177 37 165 57 206 66 184 71 165Z';
  }
  if (a.pose === 'sing' && [1,2,3,4].includes(a.top)) {
    shape = side
      ? 'M112 153 128 158 144 153 160 169 178 208 163 174 180 168 196 215 192 232 176 240 157 222 149 270 105 270 106 239 98 266 80 251 91 205 99 166Z'
      : 'M97 154 112 159 127 153 146 162 177 209 163 174 180 168 196 215 192 232 176 240 147 211 143 268 112 275 84 264 84 211 72 250 57 258 45 240 62 182 72 166Z';
  }
  let result = p(shape, color);
  const neckline = side ? 'M113 154Q128 175 144 155' : 'M96 154Q110 176 124 153';
  result += p(neckline, neck, 'stroke-width="1.8"');
  if (a.top === 0) {
    result += line(side ? 'M98 203 105 208M149 205 163 200M103 256Q126 266 145 258M108 178 103 197' : 'M59 199 75 207M143 204 156 198M87 257 120 267 140 258M77 175 83 192');
    if (!back) result += (side ? '<g transform="translate(19 0)">' : '<g>') + [ [103,193],[111,192],[120,191],[102,201],[112,200],[121,199] ].map(([x,y], i) => circle(x,y,i === 2 ? 2.4 : 2.8,ink,'stroke="none"')).join('') + '</g>';
    else result += line(side ? 'M117 171 141 172' : 'M97 171 122 171');
    result += shade(side ? 'M103 206 112 231 106 260 99 258Z' : 'M82 209 96 246 86 260 82 258Z');
  }
  if (a.top === 1) {
    if (!back) result += p(side ? 'M121 158 141 157 148 261 123 267 115 248Z' : 'M104 157 124 153 137 263 112 269 97 253Z',paper) + p(side ? 'M112 150 125 159 114 184 104 172ZM142 153 152 169 140 185 136 163Z' : 'M93 149 109 158 98 183 78 169ZM126 150 141 166 127 184 119 161Z',color) + line(side ? 'M114 184 116 253M141 186 146 249' : 'M98 185 100 255M128 185 136 251');
    else result += line(side ? 'M110 179 150 180M130 183 133 254' : 'M82 180Q109 187 144 178M115 184 118 256');
    result += p(side ? 'M99 197 111 195 111 217 95 219ZM146 197 157 200 160 219 147 218Z' : 'M74 198 94 194 94 219 71 222ZM132 196 149 199 154 219 136 218Z','none','stroke-width="1.6"') + line(side ? 'M93 236 104 228M149 241 163 230M88 249 99 253' : 'M61 240 79 225M143 239 162 230M59 248 73 255') + shade(side ? 'M108 185 118 196 111 262 104 258Z' : 'M80 184 89 199 84 259 78 251Z');
  }
  if (a.top === 2) {
    // The long shirt and knitted vest have independently legible silhouettes.
    result = p(shape,paper) + p(side ? 'M112 154 128 159 143 154 152 164 146 219 150 243 106 248 107 215 103 167Z' : 'M95 154 110 159 124 153 139 162 135 214 143 241 84 247 88 211 80 166Z',color);
    result += p(side ? 'M117 157 130 182 140 156 144 161 131 193 111 163Z' : 'M99 157 113 184 122 156 128 159 114 195 92 161Z',color) + line(side ? 'M108 238 148 233M112 237 112 245M119 236 120 244M128 235 128 243M137 234 137 242M144 234 145 241' : 'M87 236 139 231M92 236 93 244M101 235 102 243M110 234 111 242M120 233 121 241M131 232 132 240') + line(side ? 'M83 252 98 256M140 256 160 250' : 'M60 251 78 255M142 259 159 255');
    if (back) result += line(side ? 'M119 171 143 168' : 'M96 171 124 169');
  }
  if (a.top === 3) {
    result += p(side ? 'M113 153 128 161 143 153 146 161 131 175 109 163Z' : 'M94 153 110 162 125 153 129 161 111 176 90 162Z',color) + line(side ? 'M130 175 132 263M107 258 145 260M104 261 145 264M87 247 99 253M141 258 162 248' : 'M111 176 113 263M84 258 136 258M83 263 137 263M56 246 75 255M143 259 164 248') + line(side ? 'M113 222 106 240M149 222 155 236' : 'M91 221 85 240M134 220 141 238') + shade(side ? 'M102 185 112 204 106 249 101 238Z' : 'M71 184 84 206 77 246 69 245Z');
    if (back) result += p(side ? 'M114 191 143 185 143 198 127 206Z' : 'M93 190 127 185 128 198 108 207Z',paper,'stroke-width="1.3"');
    else result += circle(side ? 146 : 140,190,5,paper,'stroke-width="1"') + line(side ? 'M143 190 149 190' : 'M137 190 143 190');
  }
  if (a.top === 4) {
    const stripes = side ? ['M104 180 160 184 164 200 99 195Z','M103 216 144 218 146 230 101 230Z','M102 248 148 249 149 261 101 262Z','M92 200 103 205 99 221 86 216Z','M82 230 95 236 92 249 77 244Z','M148 219 166 216 168 230 151 233Z','M153 251 172 245 174 257 155 264Z'] : ['M68 182 151 184 155 198 63 196Z','M82 214 135 217 137 231 82 229Z','M82 248 139 248 141 263 84 262Z','M60 207 77 214 73 229 55 221Z','M49 235 66 244 59 256 46 243Z','M139 220 161 216 163 230 142 235Z','M144 252 164 247 167 257 147 265Z'];
    result += stripes.map(d => p(d,a.topColor===0?'#807060':paper,'stroke="none"')).join('') + line(side ? 'M102 258 122 267 146 259M109 176 106 202M136 169 153 179' : 'M86 260 113 267 137 260M77 174 85 199M133 176 138 199');
    result += p(shape,'none');
  }
  if (a.top === 5) result += line(side ? 'M107 165Q106 189 110 205M149 166 146 188M109 225 145 224' : 'M90 166Q86 187 91 204M135 166 130 190M92 223 130 226') + shade(side ? 'M102 189 113 210 111 230 105 230Z' : 'M84 189 96 212 94 230 88 228Z');
  if (a.pose === 'wave' && [1,2,3,4].includes(a.top)) result += p(side?'M40 178 59 166 63 176 44 188Z':'M18 177 37 165 42 176 22 187Z',a.top===2?paper:color) + line(side?'M48 180 58 174':'M26 180 37 173');
  if (a.pose === 'sing' && [1,2,3,4].includes(a.top)) result += p('M162 174 180 168 183 179 167 186Z',a.top===2?paper:color) + line('M170 179 179 176');
  // Keep printed stripes, seams and old cuff details inside the selected garment silhouette.
  // IDs describe only the silhouette; identical IDs in a multi-avatar DOM refer to identical paths.
  const clipId = `illustrated-cloth-${a.top}-${side?'side':quarter?'quarter':'front'}-${a.pose}`;
  return layer('top', a.top, `<defs><clipPath id="${clipId}">${p(shape, '#fff','stroke="none"')}</clipPath></defs><g clip-path="url(#${clipId})">${result}</g>${p(shape,'none')}`);
}

function hairBack(a, side, back) {
  const color = HAIRS[a.hairColor];
  const front = [
    'M81 73 82 112 92 143 107 125 137 131 151 109 160 73 139 53Z',
    'M74 66Q100 46 145 58L162 76 157 113 145 146 139 129 132 144 125 111 95 111 80 137 71 109Z',
    'M70 66 73 99 63 137 88 118 94 153 108 126 127 151 134 122 155 143 154 109 173 118 158 78Z',
    'M134 60 156 47 179 62 175 88 182 159 162 139 157 186 143 150 151 111 139 92Z',
    'M82 57Q99 39 128 45Q155 40 162 73L162 107 145 136 132 126 111 134 88 129 78 106Z',
    'M75 67Q83 33 127 39L159 66 158 140 140 126 124 134 95 128 74 136Z',
    'M76 64Q85 40 123 45Q151 37 161 73L156 118 144 139 128 126 108 137 87 126 75 104Z',
    'M83 75Q89 47 123 44Q152 43 160 79L151 111 88 112Z',
  ];
  const profiles = [
    'M99 65 122 48 150 54 166 75 144 124 118 141 99 117 91 89Z',
    'M94 62Q113 44 146 51L164 69 151 109 141 151 124 134 117 144 98 121 92 88Z',
    'M91 62 112 48 148 48 164 71 155 96 161 125 141 119 132 153 114 125 97 144 102 112 86 117Z',
    'M110 62 104 48 84 43 70 70 80 104 68 161 89 145 96 180 108 143 100 108 116 93Z',
    'M101 51Q137 34 158 57L167 81 157 110 144 128 114 133 94 111 90 78Z',
    'M94 64Q112 32 148 47L167 71 154 110 151 146 122 132 97 142Z',
    'M94 60Q118 37 150 49L163 78 153 113 141 141 122 125 103 138 90 105Z',
    'M101 64Q127 35 153 54L164 80 146 120 104 113 94 87Z',
  ];
  let result = p((side ? profiles : front)[a.hair],color);
  if (a.hair === 4) {
    const points = side ? [[102,57],[116,48],[133,46],[149,52],[158,63],[95,73],[93,91],[98,111],[112,126],[140,125]] : [[80,65],[88,49],[105,42],[124,40],[143,48],[159,62],[165,84],[155,108],[143,125],[94,123],[78,107],[71,87]];
    result += points.map(([x,y],i) => `<g transform="rotate(${(i%3-1)*24} ${x} ${y})">${p(`M${x-4} ${y+9}q-5 -10 -1 -19l8 -2 3 9 -3 12Z`,color)}${line(`M${x-3} ${y-7}l8 2M${x-3} ${y}l6 2`)}</g>`).join('');
  }
  if (back) result += shade(side ? 'M100 72 118 70 129 119 110 128 95 112Z' : 'M80 71 101 56 113 113 92 131 78 108Z','.13');
  return layer('hair-back', a.hair, result);
}

function face(a, side, quarter, back) {
  const skin = SKINS[a.skin];
  let neck = p(side ? 'M116 124 139 124 143 157 132 171 112 155Z' : 'M102 122 125 124 125 155 112 168 95 155 102 145Z',skin) + shade(side ? 'M117 129 139 129 141 150 120 146Z' : 'M102 132 125 132 125 148 101 145Z','.16');
  if (back) return layer('neck','back',neck);
  const shape = side ? 'M105 76Q122 54 145 67L155 80 154 93 166 105 155 111 151 129 131 140 114 129 105 112 97 108 94 96 101 90Z' : quarter ? 'M91 77Q109 57 133 66L151 80 153 96 162 108 152 115 144 131 128 141 109 134 99 123 95 108 86 105 83 94 87 87Z' : 'M83 77Q113 53 141 72L151 90 148 115 136 132 116 139 96 133 84 119 81 107 73 102 73 91 79 86Z';
  neck += layer('face',side?'side':quarter?'quarter':'front',p(shape,skin) + shade(side?'M104 80 115 81 112 105 119 126 131 138 116 131 105 112 99 107 99 92Z':quarter?'M93 82 103 88 104 117 119 136 109 133 99 122 94 107 88 102 87 94Z':'M85 83 95 88 93 113 102 132 96 131 84 119 80 107 76 100 79 91Z','.1') + line(side?'M102 97 108 94 109 106M154 112 150 113':quarter?'M87 94 92 97 93 104M152 111 157 111':'M77 93 82 95 82 102'));
  return layer('skin',a.skin,neck);
}

function facialFeatures(a, side, quarter, back) {
  if (back) return '';
  const eye = (x,y,w,flip=false) => `<g stroke="${ink}" transform="${flip?`translate(${2*x+w} 0) scale(-1 1)`:''}">${p(`M${x} ${y}q${w/2} -5 ${w} 1q-${w/2-2} 14 -${w-2} 6Z`,paper,'stroke-width="1.5"')}${p(`M${x+6} ${y-1}l8 1 -1 8q-5 3 -7 -1Z`,ink,'stroke="none"')}${p(`M${x-1} ${y-2}q${w/2} -4 ${w+3} 2`,'none','stroke-width="3"')}</g>`;
  let detail = side ? eye(131,92,18) + line('M129 83 147 83M146 116 152 115') : quarter ? eye(106,98,22) + eye(140,94,12) + line('M105 88 124 91M141 85 151 86M136 107 134 115 140 115') : eye(87,99,23) + eye(124,98,23) + line('M86 88 107 91M126 89 146 86M116 108 113 116 118 116');
  if (a.expression === 'wink') detail = side ? line('M132 98 147 96M131 84 147 85') : detail.replace(eye(quarter?140:124,quarter?94:98,quarter?12:23),p(quarter?'M140 100 152 97':'M126 104 144 101','none','stroke-width="2.3"'));
  if (a.expression === 'focused') detail += p(side?'M129 87 147 86':quarter?'M106 93 124 95M140 89 151 88':'M88 92 108 96M126 94 145 90','none','stroke-width="2"');
  detail += p(side ? (a.expression === 'smile' ? 'M142 124q6 3 10 -2':'M142 124 149 123') : quarter ? (a.expression === 'smile'?'M129 127q7 3 12 -2':'M129 128 138 127') : (a.expression === 'smile'?'M109 126q9 6 16 -1':'M109 127 120 128'),'none','stroke-width="1.8"');
  // Facial marks remain readable on the deepest skin tone. Glasses never supply
  // the eyebrows, nose or mouth: removing eyewear keeps the same face and gaze.
  return layer('features',a.expression,`<g stroke="${a.skin===4?'#edc7a2':ink}">${detail}</g>`);
}

function eyewear(a, side, quarter, back) {
  if (!a.eyewear) return layer('eyewear',0,'');
  if (back) return layer('eyewear',a.eyewear,p(side?'M103 90 113 92':'M81 94 86 96M148 89 155 91','none',`stroke="${a.eyewear===2?'#795343':ink}" stroke-width="${[0,3.8,2.8,3.2,1.5,2.4][a.eyewear]}"`));
  const color = a.eyewear === 2 ? '#795343' : ink;
  if (side) {
    const shape = ['','M123 91 152 87 150 107Q137 116 129 105Z','M122 90 158 81 149 107Q136 113 128 104Z','M124 89 153 85 150 100 129 104Z','M129 98a11 12 0 1 0 22 -4a11 12 0 1 0 -22 4','M124 91 139 86 154 87 152 103 136 110 127 104Z'][a.eyewear];
    return layer('eyewear',a.eyewear,p(shape,a.eyewear===3?ink:'none',`stroke="${color}" stroke-width="${a.eyewear===4?1.6:3.8}"`) + p('M124 93 108 90 102 96','none',`stroke="${color}" stroke-width="2.3"`)+(a.eyewear===3?line('M132 92 143 89'):''));
  }
  const left = quarter ? 101 : 82, right=quarter?136:122, far=quarter?19:27;
  let frames = '';
  if (a.eyewear === 1) frames=p(`M${left} 92l29 4 -4 20q-15 7 -22 -3ZM${right} 92l${far} -3 -4 22q-${far-16} 10 -${far-7} 2Z`,'none',`stroke="${color}" stroke-width="4.4"`);
  if (a.eyewear === 2) frames=p(`M${left-4} 85l34 12 -5 18q-20 8 -29 -30ZM${right} 94l${far+3} -13 -7 28q-${far-11} 11 -${far-4} -1Z`,'none',`stroke="${color}" stroke-width="3.3"`);
  if (a.eyewear === 3) frames=p(`M${left} 92l30 5 -4 14 -23 -5ZM${right} 94l${far+1} -5 -5 17 -${far-4} 4Z`,ink) + p(`M${left+5} 96l13 2M${right+5} 97l12 -3`,'none','stroke="#c2bda8" stroke-width="1.3"');
  if (a.eyewear === 4) frames=`<ellipse cx="${left+15}" cy="104" rx="15" ry="14" fill="none" stroke-width="1.7"/><ellipse cx="${right+far/2}" cy="101" rx="${far/2}" ry="14" fill="none" stroke-width="1.7"/>`;
  if (a.eyewear === 5) frames=p(`M${left} 92l12 -2 20 8 -5 16 -13 3 -13 -8ZM${right} 95l${far/2} -7 ${far/2+1} 1 -3 19 -${far/2-1} 5 -${far/2-1} -6Z`,'none',`stroke="${color}" stroke-width="3"`);
  frames+=p(`M${left+29} 101q4 -5 ${right-left-29} 0M${left} 94l-8 -4M${right+far} 92l4 -5`,'none',`stroke="${color}" stroke-width="2.4"`);
  return layer('eyewear',a.eyewear,frames);
}

function hairFront(a, side, quarter, back) {
  const color = HAIRS[a.hairColor];
  const shapes = side ? [
    'M93 86 90 64 106 48 101 35 122 43 143 36 162 53 172 70 150 66 141 83 130 69 120 101 114 81 104 101Z',
    'M93 94Q85 75 93 56L109 41Q130 31 150 44L172 61 154 62 160 83 145 71 140 97 132 68 123 96 117 112 113 83 102 111Z',
    'M91 91 79 81 92 60 80 50 106 48 101 27 122 41 143 26 141 44 170 38 160 55 179 65 158 72 167 95 146 83 143 110 134 70 120 95 111 77 102 109Z',
    'M93 87 93 62 111 48 131 40 149 48 166 66 151 67 143 87 133 70 127 106 114 79 109 110 102 81Z',
    'M100 81 99 65 114 55 133 51 151 59 159 77 148 72 143 89 133 72 127 91 117 75 109 88Z',
    'M94 93 91 73 100 51 124 38 146 44 164 62 171 83 155 82 151 62 146 88 131 86 128 63 123 89 109 87 111 66 103 93 102 119Z',
    'M92 91 93 65 109 46 125 47 135 42 152 52 166 74 152 99 150 75 135 57 128 75 117 94 111 112 110 76 100 99Z',
    'M97 89 95 73 104 53 125 45 146 49 161 69 158 81 148 69 119 64 110 86 104 92Z',
  ] : [
    'M74 85 70 68 85 50 78 36 104 42 112 28 137 38 151 32 153 49 172 61 155 66 160 91 143 74 134 109 126 68 108 91 104 69 91 88 86 76 81 110Z',
    'M71 109Q60 87 68 63L83 43Q107 29 133 37L155 51 144 53 161 84 143 72 147 110 131 79 126 100 118 65 103 99 96 79 90 109 81 98 76 129Z',
    'M68 91 52 86 72 64 59 51 88 50 80 29 107 44 117 24 129 42 157 28 150 49 173 50 159 68 176 83 153 82 163 114 141 93 135 119 126 72 112 99 103 72 92 97 84 83 74 119Z',
    'M73 87 70 69 88 49 109 43 134 44 157 63 153 88 139 78 132 102 124 63 107 93 98 78 90 111 81 88Z',
    'M80 86 79 64 97 49 122 47 146 56 158 76 143 72 137 91 123 74 116 90 106 73 97 91 88 76Z',
    'M73 102 69 78 77 54 99 38 126 36 149 51 161 82 144 89 137 61 134 89 118 91 113 62 108 91 94 88 92 63 85 90 80 122Z',
    'M74 94 69 75 83 51 105 43 118 47 131 40 150 52 160 77 151 109 142 90 135 68 119 56 112 75 96 92 91 114 86 78 80 103Z',
    'M76 90 74 76 83 57 105 45 129 43 151 57 157 79 145 73 132 63 111 65 92 70 86 91 82 103Z',
  ];
  if (back) {
    const shape=side?shapes[a.hair]:shapes[a.hair];
    return layer('hair-front',a.hair,p(shape,color)+p(side?'M104 80Q106 115 124 134M125 55 133 111M142 59 144 108':'M84 73Q85 111 98 130M103 54 113 117M135 57Q147 94 140 126','none','stroke-width="1.3" opacity=".48"'));
  }
  return layer('hair-front',a.hair,p(shapes[a.hair],color) + (a.hair===4 ? '' : p(side?'M108 58 121 50M133 49 146 56':'M88 55 101 45M123 41 144 50','none','stroke="#f3e7cf" stroke-width="1.25" opacity=".42"')) + (a.hair===7?Array.from({length:14},(_,i)=>circle((side?102:84)+(i%7)*7,62+Math.floor(i/7)*8,.8,ink,'stroke="none" opacity=".4"')).join(''):''));
}

function accessories(a, side, back) {
  let result = '';
  if (a.accessory === 'headphones') result=p(side?'M96 95Q80 41 122 37Q154 37 161 75':'M71 96Q57 38 107 30Q155 23 168 84','none','stroke="#bfae86" stroke-width="8"') + p(side?'M94 87 107 86 111 111 98 114Z':'M66 87 79 88 83 114 70 115ZM157 82 168 81 170 108 160 111Z',ink) + p(side?'M100 91 104 109':'M72 92 76 110M162 88 164 104','none','stroke="#bfae86" stroke-width="3"');
  if (a.accessory === 'earbuds') result=p(side?'M103 99 106 100 108 113':'M79 101 83 102 85 114M152 99 156 98 156 111','none','stroke="#f3e7cf" stroke-width="4"');
  if (a.accessory === 'cap') result=p(side?'M91 70Q91 36 124 33Q151 32 160 61L185 77 155 80 130 66 94 80Z':'M70 74Q70 33 107 28Q145 22 160 59L180 74 152 81 112 63 72 84Z',GARMENT_COLORS[a.topColor]) + line(side?'M121 39 129 59M139 39 146 59':'M109 33 112 57M139 38 146 60') + p(side?'M129 47h10v4h-10Z':'M118 40h12v4h-12Z',paper,'stroke="none"');
  if (a.accessory === 'chain') result=back ? line(side?'M113 155 130 163 143 157':'M97 155Q112 166 126 154') : p(side?'M114 155 132 191 144 156':'M97 155 113 192 125 154','none','stroke="#b99b5a" stroke-width="2.4"')+p(side?'M132 190v12l7 -3v-9ZM113 190v12l7 -3v-9Z'.split('Z')[0]+'Z':'M113 190v12l7 -3v-9Z','#b99b5a','stroke-width="1"');
  if (a.accessory === 'crossbody') {
    result=p(side?'M150 160 101 257':'M141 160 77 257','none','stroke="#342d2c" stroke-width="7"')+p(side?'M150 160 101 257':'M141 160 77 257','none','stroke="#b59b72" stroke-width="3"');
    result+=p(side?'M88 242 118 247 115 294 82 291 80 259Z':'M64 243 96 249 96 291 61 291 57 259Z','#757d62')+p(side?'M85 252 116 258 115 275 82 270Z':'M60 255 94 260 96 275 60 272Z','#626b54')+circle(side?100:77,269,9,ink,'stroke-width="1"')+circle(side?100:77,269,2,paper,'stroke="none"');
  }
  return layer('accessory',a.accessory,result);
}

export function renderIllustratedLayers(a, view) {
  const side=view==='side',back=view==='back',quarter=view==='quarter';
  const head = hairBack(a,side,back)+face(a,side,quarter,back)+facialFeatures(a,side,quarter,back)+eyewear(a,side,quarter,back)+hairFront(a,side,quarter,back);
  const headAccessory = ['headphones','earbuds','cap'].includes(a.accessory);
  const lean = {listen:-1.2,sway:4.8,wave:-3.4,sing:2.2}[a.pose] || 0;
  const tilt = {listen:-6,sway:5,wave:-9,sing:-11}[a.pose] || -6;
  const torso = layer('torso',a.skin,p(side?'M115 149 141 148 151 182 146 237 149 254 103 259 108 225 104 177Z':'M101 148 124 146 143 175 132 222 146 254 83 259 91 224 81 179Z',SKINS[a.skin])+shade(side?'M107 187 114 225 110 251 104 254Z':'M88 184 99 225 92 253 85 254Z'));
  const microphone = a.pose==='sing' ? layer('gesture-prop','microphone',`<g transform="rotate(-12 169 147)">${p('M165 135 174 135 173 169 168 170Z',ink)}<ellipse cx="169" cy="133" rx="8" ry="11" fill="#766f65"/>${line('M164 128 174 128M163 133 175 133M164 138 174 138')}${p('M170 170Q187 229 164 255','none','stroke-width="1.4"')}</g>`) : '';
  return `<g stroke="${ink}" stroke-width="2.15" stroke-linejoin="round" stroke-linecap="round">${legs(a,side,back)}${shoes(a,side,back)}${bottoms(a,side,back)}<g data-layer="stance" data-pose="${a.pose}" transform="rotate(${lean} 119 263)">${torso}${arms(a,side,back)}${tops(a,side,back,quarter)}<g data-layer="head" transform="rotate(${back?-tilt:tilt+(side?1:quarter?-1:0)} 117 133)">${head}${headAccessory?accessories(a,side,back):''}</g>${!headAccessory?accessories(a,side,back):''}${microphone}</g></g>`;
}
