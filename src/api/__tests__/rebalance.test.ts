import flatten from "lodash/flatten";
import sum from "lodash/sum";
import sumBy from "lodash/sumBy";
import { sprintf } from "sprintf-js";
import { rebalance } from "../rebalance";

test("real-life", async () => {
  runSnapshot("real-life", {
    m1: [],
    m2: [
      3102510, 2310389, 3431636, 2812913, 2809915, 3373267, 3533675, 2904572,
      3028968, 3763126, 3330395, 5513279, 4499457, 2620674, 4204222, 3068099,
      4044060, 2590400, 3398307, 3549054, 2705941, 2446029, 2543947, 3043896,
      3185788, 3687653, 3011137, 3123301, 2968407, 2878138, 4008534, 2606604,
      3583219, 3103622, 3296268, 2898755, 3429745, 2704922, 3047716, 4353234,
      2977721, 2952326, 3165026, 5621594, 2866982, 2963043, 3029183, 3165786,
    ],
    m3: [],
    m4: [
      2941652, 2259896, 2897068, 2441056, 2173301, 2557906, 3189854, 3262413,
      3596507, 2850071, 2742650, 3007119, 3146139, 2732076, 2782602, 2843946,
      2971959, 2650268, 4630436, 2509163, 2823596, 2496160, 4094308, 3715544,
      3780254, 2473756, 3902806, 3177622, 2752508, 2610157, 2460287, 3588799,
      3315124, 3386548, 2841916, 3389682, 2882752, 2721151, 2898093, 2891522,
      3063611, 2924353, 3016623, 2736916, 2567722, 2250799, 3290465, 2302616,
      3266051, 2737137, 3368923, 2739823, 2457847, 2588240, 3388789, 3253895,
      2748270, 2490298, 3042848, 2685534, 2657002,
    ],
    m5: [
      2402111, 3635241, 3494375, 4003589, 2644282, 3792954, 3031608, 2736750,
      11682545, 2537989, 2789315, 3576189, 2573423, 2999839, 3195822, 2850765,
      3003699, 2800095, 3373183, 3192320, 2466714, 3070357, 2320580, 2835098,
      3759990, 2856268, 2578693, 2924938, 4521645, 2940125, 3526950, 2532835,
      2867802, 2786013, 3572643, 3286283, 4558305, 6562024, 3357344, 2560850,
      3622079, 2700293, 2638270, 2358971, 2690906, 2737271, 2679169, 2896335,
      5173294, 3241496, 2641623, 2708660, 3026319, 3018266, 2776485, 3897435,
      3933529, 2839020, 3071322, 4652406, 3633723, 3720616, 3242648, 2349381,
      2801277, 3116048, 3872269, 3145946, 2958505, 3479378, 4414286, 3757053,
      2871581, 2612754, 2440424, 2705234, 3717549, 4245181, 3699579, 2762198,
      2877770, 2926338, 3206583, 3513134, 2683638, 2673500, 2367037, 2968401,
      3413508, 2307521, 3420950, 2500139, 2308110, 2532689, 2875158, 3639822,
      2573277, 2886183, 3512852, 3652854, 3666576, 2831328,
    ],
    m6: [
      3210829, 2599238, 3261651, 3013344, 2994142, 2817397, 2914849, 3466772,
      2798274, 3160658, 4189071, 60846732, 2774519, 2921195, 3273649, 2762413,
      3398789, 5174865, 3458114, 3212180, 3243874, 2420268, 2914613, 3460018,
      3238051, 3099167, 3156420, 3208024, 3609000, 3743240, 3784360, 2959994,
      2997000, 3412687, 2478898, 3143575, 3009686, 3180545, 3334735, 3322849,
      3031021, 2760785, 3364934, 2902034, 2752392, 3147604, 2464625, 2488516,
      2844696, 3120980, 2783978, 3106528, 2295123, 3116163, 2671385, 2900650,
      2700870, 2613138, 2724027, 3489817, 3009028, 3005714, 2825044, 2761433,
      2746928, 4153615, 3035247, 3166575, 3125205, 3486267, 3436957, 2730814,
      3037462, 3305552, 2706198, 2957812, 3715174, 3008117, 3177874, 2779452,
      3149109, 2842873, 3746175, 3403372, 2711371, 3976340, 3468210, 3180945,
    ],
  });
});

test("synthetic", async () => {
  runSnapshot("empty", {});

  runSnapshot("no-op 1", {
    m1: [1],
  });

  runSnapshot("no-op 2", {
    m1: [1],
    m2: [],
  });

  runSnapshot("no-op 2", {
    m1: [],
    m2: [1],
  });

  runSnapshot("move smallest out", {
    m1: [1, 2],
    m2: [],
  });

  runSnapshot("move largest out", {
    m1: [1, 2, 3, 6],
    m2: [],
  });

  runSnapshot("move many small out", {
    m1: [1, 2, 3, 7],
    m2: [],
  });

  runSnapshot("huge shards", {
    m1: [10000, 100, 1, 2, 3, 4, 5],
    m2: [],
    m3: [],
    m4: [],
    m5: [],
  });

  runSnapshot("zero-weight shards only", {
    m1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    m2: [],
    m3: [],
    m4: [],
  });

  runSnapshot("zero-weight shards and non-empty", {
    m1: [1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0],
    m2: [],
    m3: [],
    m4: [],
  });

  runSnapshot(
    "decommission of one",
    {
      m1: [1, 2],
      m2: [3, 4],
      m3: [5, 6],
    },
    ["m2"],
  );

  runSnapshot(
    "decommission of two",
    {
      m1: [1, 2],
      m2: [3, 4],
      m3: [5, 6],
    },
    ["m1", "m2"],
  );

  await expect(
    (async () =>
      runSnapshot(
        "bad decommission of all",
        {
          m1: [1, 2],
          m2: [3, 4],
          m3: [5, 6],
        },
        ["m1", "m2", "m3"],
      ))(),
  ).rejects.toThrow(/all islands/);

  runSnapshot("two zero weight and two equal weight", {
    m1: [0, 134, 134, 0],
    m2: [],
    m3: [],
    m4: [],
  });
});

let counter = 0;

function runSnapshot(
  name: string,
  islandsFrom: Record<string, number[]>,
  decommissionNames: string[] = [],
): void {
  const islandNames = Object.keys(islandsFrom);

  const islands = new Map(
    Object.values(islandsFrom).map((weights, islandNo) => [
      islandNo,
      weights.map((weight) => ({ weight })),
    ]),
  );
  const moves = rebalance(
    islands,
    decommissionNames.map((name) => islandNames.indexOf(name)),
  );
  const islandsTo = Object.fromEntries(
    [...islands.entries()].map(
      ([islandNo, shards]) =>
        [islandNames[islandNo], shards.map(({ weight }) => weight)] as const,
    ),
  );

  const desiredWeight =
    islandNames.length > 0
      ? sum(flatten(Object.values(islandsFrom))) / islandNames.length
      : 0;
  expect(
    "\n" +
      `  desiredWeight=${desiredWeight}\n` +
      "===\n" +
      inspectIslands(islandsFrom) +
      "==>\n" +
      inspectIslands(islandsTo) +
      "===\n" +
      `  ${sumBy(moves, ({ shards }) => shards.length)} move(s):\n` +
      moves
        .map(
          ({ from, to, shards }) =>
            `  - ${islandNames[from]}->${islandNames[to]}: [` +
            shards.map(({ weight }) => weight) +
            "]\n",
        )
        .join(""),
  ).toMatchSnapshot(`${sprintf("%02d", counter++)}: ${name}`);
}

function inspectIslands(islands: Record<string, number[]>): string {
  const totalWeight = sum(flatten(Object.values(islands))) || 1;
  return Object.entries(islands)
    .map(
      ([islandName, weights]) =>
        `  ${islandName}: sum=${sprintf("%-10d", sum(weights))} ` +
        `(${sprintf("%.2f", (sum(weights) / totalWeight) * 100)}%) ` +
        `[${weights}]\n`,
    )
    .join("");
}
