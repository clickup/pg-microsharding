[@clickup/pg-microsharding](README.md) / Exports

# @clickup/pg-microsharding

## Interfaces

- [Shard](interfaces/Shard.md)

## Functions

### actionAllocate

▸ **actionAllocate**(`args`): `Promise`\<`boolean`\>

Ensures that some shards exist.

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `ParsedArgs` |

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/actions/actionAllocate.ts:9](https://github.com/clickup/pg-microsharding/blob/master/src/actions/actionAllocate.ts#L9)

___

### actionCleanup

▸ **actionCleanup**(`args`): `Promise`\<`boolean`\>

Removes previously moved schema originals from the source database.

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `ParsedArgs` |

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/actions/actionCleanup.ts:12](https://github.com/clickup/pg-microsharding/blob/master/src/actions/actionCleanup.ts#L12)

___

### actionList

▸ **actionList**(`args`): `Promise`\<`boolean`\>

Shows the list of microshards and their weights.

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `ParsedArgs` |

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/actions/actionList.ts:16](https://github.com/clickup/pg-microsharding/blob/master/src/actions/actionList.ts#L16)

___

### calcIslandWeights

▸ **calcIslandWeights**(`«destructured»`): `Promise`\<\{ `islandNosToDsn`: `Map`\<`number`, `string`\> ; `islands`: `Map`\<`number`, `NonNullable`\<`Awaited`\<`ReturnType`\<typeof [`weights`](modules.md#weights)\>\>\>\>  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dsns` | `string`[] |
| › `weightSql` | `undefined` \| `string` |
| › `includeIsolatedShard0` | `boolean` |

#### Returns

`Promise`\<\{ `islandNosToDsn`: `Map`\<`number`, `string`\> ; `islands`: `Map`\<`number`, `NonNullable`\<`Awaited`\<`ReturnType`\<typeof [`weights`](modules.md#weights)\>\>\>\>  }\>

#### Defined in

[src/actions/actionList.ts:92](https://github.com/clickup/pg-microsharding/blob/master/src/actions/actionList.ts#L92)

___

### actionMove

▸ **actionMove**(`args`): `Promise`\<`boolean`\>

Moves a shard from one database to another with no downtime.

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `ParsedArgs` |

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/actions/actionMove.ts:11](https://github.com/clickup/pg-microsharding/blob/master/src/actions/actionMove.ts#L11)

___

### actionRebalance

▸ **actionRebalance**(`args`): `Promise`\<`boolean`\>

Runs a series of shard modes, concurrently, using TMUX if available.

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `ParsedArgs` |

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/actions/actionRebalance.ts:27](https://github.com/clickup/pg-microsharding/blob/master/src/actions/actionRebalance.ts#L27)

___

### allocate

▸ **allocate**(`«destructured»`): `Promise`\<`void`\>

Ensures that all shards in the range exist on the DSN, then runs a shell
script (presumably DB migration), and then optionally activates the shards.

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dsn` | `string` |
| › `from` | `number` |
| › `to` | `number` |
| › `migrateCmd` | `string` |
| › `activate` | `boolean` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/api/allocate.ts:10](https://github.com/clickup/pg-microsharding/blob/master/src/api/allocate.ts#L10)

___

### cleanup

▸ **cleanup**(`«destructured»`): `Promise`\<`void`\>

Removes old and semi-migrated schemas.

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dsn` | `string` |
| › `noOldShards?` | (`oldSchemaNameRe`: `string`) => `Promise`\<`void`\> |
| › `confirm?` | (`schemas`: `string`[]) => `Promise`\<`boolean`\> |

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/api/cleanup.ts:8](https://github.com/clickup/pg-microsharding/blob/master/src/api/cleanup.ts#L8)

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
| › `deactivateSQL?` | `string` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/api/move.ts:20](https://github.com/clickup/pg-microsharding/blob/master/src/api/move.ts#L20)

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
| `TShard` | extends [`Shard`](interfaces/Shard.md) |

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `islands` | `Map`\<`number`, readonly `TShard`[]\> | `undefined` |
| `decommissionIslandNos` | `number`[] | `[]` |
| `fractionOfMedianToConsiderEmpty` | `number` | `DEFAULT_FRACTION_OF_MEDIAN_TO_CONSIDER_EMPTY` |

#### Returns

\{ `from`: `number` ; `to`: `number` ; `shards`: `TShard`[]  }[]

#### Defined in

[src/api/rebalance.ts:64](https://github.com/clickup/pg-microsharding/blob/master/src/api/rebalance.ts#L64)

___

### weights

▸ **weights**(`«destructured»`): `Promise`\<\{ `weight`: `number` ; `unit`: `string` \| `undefined` ; `schema`: `string` ; `no`: `number`  }[] \| ``null``\>

Similar tp listActiveSchemas(), but also returns the weight of each
microshard and its number.

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dsn` | `string` |
| › `weightSql` | `undefined` \| `string` |
| › `includeIsolatedShard0` | `boolean` |

#### Returns

`Promise`\<\{ `weight`: `number` ; `unit`: `string` \| `undefined` ; `schema`: `string` ; `no`: `number`  }[] \| ``null``\>

#### Defined in

[src/api/weights.ts:10](https://github.com/clickup/pg-microsharding/blob/master/src/api/weights.ts#L10)

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

[src/cli.ts:73](https://github.com/clickup/pg-microsharding/blob/master/src/cli.ts#L73)
