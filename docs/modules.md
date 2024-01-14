[@clickup/pg-sharding](README.md) / Exports

# @clickup/pg-sharding

## Functions

### cleanup

▸ **cleanup**(`«destructured»`): `Promise`\<`void`\>

Removes old and semi-migrated schemas.

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dsn` | `string` |
| › `confirm?` | (`schemas`: `string`[]) => `Promise`\<`boolean`\> |

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/api/cleanup.ts:8](https://github.com/clickup/pg-sharding/blob/master/src/api/cleanup.ts#L8)

___

### move

▸ **move**(`«destructured»`): `Promise`\<`void`\>

Moves a shard from one master DB to another.

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `shard` | `number` |
| › `fromDsn` | `string` |
| › `toDsn` | `string` |
| › `activateOnDestination` | `boolean` |
| › `deactivateScript?` | `string` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/api/move.ts:20](https://github.com/clickup/pg-sharding/blob/master/src/api/move.ts#L20)

___

### rebalance

▸ **rebalance**\<`TShard`\>(`islands`, `decommissionIslandNos?`, `fractionOfMedianToConsiderEmpty?`): \{ `from`: `number` ; `to`: `number` ; `shards`: `TShard`[]  }[]

Accepts a list of islands (an island is a collection of shards with different
weights). Modifies it to make the shards being distributed more fairly.
Returns the list of shards moves.

ChatGPT mentions several related academical problems:
- "linear partitioning"
- "balanced partition"
- "partition problem"

Unfortunately, none of the above approaches works out of the box due to
corner cases and heuristics we have.

The current algorithm implemented is not perfect intentionally: it doesn't
try to achieve a fully-fair distribution, because it would produce way too
many moves otherwise (shards moves are expensive). Instead, it makes
trade-offs:
1. Tries to unload the largest "overloaded" shards to the smallest island if
   such island wouldn't appear overloaded after that.
2. If there is no such island in (1) (i.e. no matter where we move it, the
   destination will be overloaded), it may still move the shard to the
   smallest island, BUT only it the final benefit of the move would be more
   than SHARD_WEIGHT_MOVE_FROM_OVERLOADED_TO_OVERLOADED_FACTOR fraction of
   the shard's weight. (We don't want to pay the price for a move which won't
   move the needle much.)
3. Compensates large shards relocations with the corresponding number of
   small shard relocations, so largest shards and smallest shards are
   redistributed more or less in sync with each other, and there will be e.g.
   no island with just 2 biggest shards, whilst other islands have tens of
   them.
4. Also, a special treatment is applied to "empty" shards. They are treated
   as "filled in the future". The shard is considered "empty" if its weight
   is less than fractionOfMedianToConsiderEmpty of a median shard's weight.
   Such shards are distributed uniformly among the islands, not looking at
   their weights; this prevents the situation when most of the "empty" shards
   appear on the same island in the end.

All those trade-offs produce a slightly imbalanced result. In real life, it
doesn't matter much though, because shards sizes are more or less equal.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TShard` | extends `Shard` |

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `islands` | `Map`\<`number`, readonly `TShard`[]\> | `undefined` |
| `decommissionIslandNos` | `number`[] | `[]` |
| `fractionOfMedianToConsiderEmpty` | `number` | `DEFAULT_FRACTION_OF_MEDIAN_TO_CONSIDER_EMPTY` |

#### Returns

\{ `from`: `number` ; `to`: `number` ; `shards`: `TShard`[]  }[]

#### Defined in

[src/api/rebalance.ts:64](https://github.com/clickup/pg-sharding/blob/master/src/api/rebalance.ts#L64)

___

### main

▸ **main**(`argv`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `argv` | `string`[] |

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/cli.ts:21](https://github.com/clickup/pg-sharding/blob/master/src/cli.ts#L21)
