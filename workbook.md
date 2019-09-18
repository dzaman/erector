-- knex is good a allowing you to specify additional select/where/join wherever you want in the query
-- our version of knex is good at supporting optional values (updateDefined, whereOpt, limitOpt, etc.)


sql`
  SELECT sh.subscription_id AS id
  FROM subscription_hold AS sh
  INNER JOIN hold_reason AS hr ON sh.hold_reason_id = hr.id
  WHERE (hr.is_automatic = false AND sh.state = 'active')
    OR (hr.is_automatic = true AND sh.state = 'active' 
      AND (sh.expires_at > now() || sh.expires_at IS NULL))
  GROUP BY sh.subscription_id
`;


sql`
  SELECT DISTINCT ON (s.id) s.id as sub_id
    s.user_id, s.pharmacy_id, s.bill_insurance, 
    s.item_id AS sub_item_id, s.due_date AS sub_due_date,
    lf.id as lf_id, lf.order_id as lf_order_id, lf.processed_at AS lf_processedon,
    nf.id AS nf_id, nf.order_id as nf_order_id, nf.state as nf_state,
    ldi.days_supply a ldi_days_supply,
    u.prescription_insurance_id, u.secondary_insurance_id,
    coalesce(nullif(${u.preferred_name}, ''), ${u.first_name}) as user_name,
    a.line_one, a.line_two, 
    j.id as jurisdiction_id, j.abbr as jurisdiction_abbr,
    cc.last4 as cc_last4, cc.brand as cc_brand,
    i.name as item_name,
    array_agg(i.drug_id) as drug_ids, array_agg(i.name) as item_names,
    ic.rx_bin,
    ib.id as insurance_bin_id,

    left join "user" as u on u.id = s.user_id
    left join order_item as lf ON lf.subscription_id = s.id AND lf.state = 'dispensed'
    left join order_item as nf ON (
      (
        nf.subscription_id = s.id AND 
        nf.state IN ('new', 'pending') AND
        nf.created_at is not null
        nf.created_at >= '2016-10-27'
      ) OR (
        nf.state = 'rejected' AND
        nf.created_at is not null AND
        nf.created_at >= '2016-10-27' AND
        nf.needs_review = true
      )
    )
    left join "order" as nfo ON nfo.id = nf.order_id
    left join item as i ON i.id = s.item_id
    left join item as ldi on ldi.id = lf.dispensed_item_id
    left join address as a on a.id = s.address_id
    left join jurisdiction as j on a.state = j.abbr
    left join credit_card as cc on ccid = s.credit_card_id
    left join insurance_card as ic on u.prescription_insurance_id = ic.id
    left join insurance_bin as ib ON ib.value = ic.rx_bin
    where (
      s.state = active AND
      s.expiration_date > now() AND
      s.refills = 'automatic' AND
      u.state = 'active' AND
      s.id NOT IN (${subscription_ids_with_active_holds})
    )
    ORDER BY s.id, lf.processed_at desc nulls last, nfo.due_date asc
    GROUP BY 
      s.id,
      lf.id,
      nf.id,
      nfo.due_date,
      ldi.days_supply,
      u.preferred_name,
      u.first_name,
      u.prescription_insurance_id,
      u.secondary_insurance_id,
      a.line_one,
      a.line_two,
      j.id,
      cc.last4,
      cc.brand,
      i.name,
      ic.rx_bin,
      ib.id
`;

public fetch_subscriptions(c: Context): Promise<RowData[]> {
  // Find all subscriptions that have at least one active hold - the sub we select cannot be in this subquery.
  const subscription_ids_with_active_holds = k('subscription_hold as sh')
    .select('sh.subscription_id as id')
    .innerJoin('hold_reason as hr', 'sh.hold_reason_id', 'hr.id')
    .where((builder) =>
      builder.where('hr.is_automatic', false)
        .andWhere('sh.state', 'active')
    )
    .orWhere((builder) =>
      builder.where('hr.is_automatic', true)
        .andWhere('sh.state', 'active')
        // automatic holds don't need to have expiration dates so we should also check for null expires_at
        // in addition to active automatic holds that are unexpired
        .andWhere((subfilter) => {
          subfilter.where('sh.expires_at', '>', k.fn.now())
          .orWhereNull('sh.expires_at');
        })
    )
    .groupBy('sh.subscription_id');

  const q =
      k('subscription as s')
        .select(k.raw('DISTINCT ON(s.id) s.id as sub_id'))
        .select(
          's.item_id as sub_item_id',
          's.due_date as sub_due_date',
          's.user_id',
          's.pharmacy_id',
          's.bill_insurance'
        )
        .select('lf.id as lf_id', 'lf.order_id as lf_order_id', 'lf.processed_at as lf_processedon')
        .select('nf.id as nf_id', 'nf.order_id as nf_order_id', 'nf.state as nf_state')
        .select('ldi.days_supply as ldi_days_supply')
        .select(k.raw('coalesce(nullif(??, \'\'), ??) as user_name', ['u.preferred_name', 'u.first_name']))
        .select('u.prescription_insurance_id', 'u.secondary_insurance_id')
        .select('a.line_one', 'a.line_two')
        .select('j.id as jurisdiction_id', 'j.abbr as jurisdiction_abbr')
        .select('cc.last4 as cc_last4', 'cc.brand as cc_brand')
        .select('i.name as item_name')
        .select(k.raw('array_agg(i.drug_id) as drug_ids'), k.raw('array_agg(i.name) as item_names'))
        .select('ic.rx_bin')
        .select('ib.id as insurance_bin_id')
        .leftJoin('user as u', 'u.id', 's.user_id')
        // we want the last dispensed item
        .leftJoin('order_item as lf', (builder) => {
          builder.on('lf.subscription_id', '=', 's.id').andOn(k.raw('lf.state = \'dispensed\''));
        })
        // we want *any* orders items in progress
        .leftJoin('order_item as nf', (builder) => {
          builder.on('nf.subscription_id', '=', 's.id')
            .andOn(k.raw('nf.state IN (\'new\', \'pending\')'))
            .andOn(k.raw('nf.created_at is not null'))
            .andOn(k.raw('nf.created_at >= \'2016-10-27\''))
            .orOn('nf.subscription_id', '=', 's.id')
            .andOn(k.raw('nf.state = ?', ['rejected']))
            .andOn(k.raw('nf.created_at is not null'))
            .andOn(k.raw('nf.created_at >= \'2016-10-27\''))
            .andOn(k.raw('nf.needs_review = ?', [true]));
        })
        .leftJoin('order as nfo', 'nfo.id', 'nf.order_id')
        .leftJoin('item as i', 'i.id', 's.item_id')
        // get the last dispensed item so we know the days supply
        .leftJoin('item as ldi', 'ldi.id', 'lf.dispensed_item_id')
        .leftJoin('address as a', 'a.id', 's.address_id')
        .leftJoin('jurisdiction as j', 'a.state', 'j.abbr')
        .leftJoin('credit_card as cc', 'cc.id', 's.credit_card_id')
        .leftJoin('insurance_card as ic', 'u.prescription_insurance_id', 'ic.id')
        .leftJoin('insurance_bin as ib', 'ib.value', 'ic.rx_bin')
        .where('s.state', 'active')
        .where('s.expiration_date', '>', k.fn.now())
        .where('s.refills', 'automatic')
        .where('u.state', 'active')
        .whereNotIn('s.id', subscription_ids_with_active_holds)
        // .where('s.id', 6537)
        // .where('s.user_id', 13931)
        // multiple nfos is not an issue because if we have >= 1 nfos we won't create a new order
        .orderBy('s.id')
        .orderByRaw('lf.processed_at desc nulls last')
        .orderBy('nfo.due_date', 'asc')
        .groupBy(
          's.id',
          'lf.id',
          'nf.id',
          'nfo.due_date',
          'ldi.days_supply',
          'u.preferred_name',
          'u.first_name',
          'u.prescription_insurance_id',
          'u.secondary_insurance_id',
          'a.line_one',
          'a.line_two',
          'j.id',
          'cc.last4',
          'cc.brand',
          'i.name',
          'ic.rx_bin',
          'ib.id'
        )
    // .limit(10)
    // .offset(2000)
  ;

  return c.pg.manyOpt(q);
}








    
k.select('sub.user_id as id', 'sub.actionable', 'sub.display_name')
.select('u.first_name', 'u.preferred_name', 'u.dob', 'u.is_vip')
// artificially weight users with tickets assigned to ops that are not also assigned to ourselves 1 hour later
// we don't want to de-prioritize any user where the current agent has one of their tickets
// eslint-disable-next-line max-len
.select(k.raw(`CASE WHEN (has_ops_assignee AND NOT my_assignment) THEN sub.actionable + interval '1 hour' ELSE sub.actionable END AS adjusted_timestamp`))
.select(k.raw('substring(last_name from 1 for 1) AS last_initial'))
.select('sub.priority as priority')
.from(
  // collect all the user tickets
  k('ticket.ticket as t')
  .select('t.user_id')
  .min('t.actionable as actionable')
  .max('t.priority as priority')
  // if any tickets have an ops assignment, return has_ops_assignee = true
  .select(k.raw(`bool_or('ops' = ANY(a.roles)) AS has_ops_assignee`))
  // if any tickets have my user id, return my_assignment = true
  .select(k.raw(`bool_or(ta.user_id = ${user_id}) AS my_assignment`))
  // aggregate all ticket display names
  .select(k.raw(`string_agg(tt.display_name, ', ') AS display_name`))
  // is any tickets have an active lease, return has_active_lease
  .select(k.raw(`bool_or(t.leasee_id IS NOT NULL AND t.lease_expires_at >= now()) AS has_active_lease`))
  .leftJoin('ticket.assignment as ta', 't.id', 'ta.ticket_id')
  .leftJoin('agent as a', function () {
    this.on('a.user_id', '=', 'ta.user_id')
        .andOn(k.raw('ta.ticket_id is not null'));
  })
  .leftJoin('ticket.topic as tt', 't.topic_id', 'tt.id')
  .where('t.state', 'open')
  .whereNotNull('t.actionable')
  .where(function () {
    this.whereNull('tt.id')
        .orWhere('tt.role', 'ops');
  })
  .groupBy('t.user_id')
  .as('sub')
)
.join('user as u', 'u.id', 'sub.user_id')
.leftJoin('jurisdiction as j', 'j.id', 'u.jurisdiction_id')
.where('has_active_lease', false)
.orderBy('priority', 'desc')
.orderBy('is_vip', 'desc')
.orderBy('adjusted_timestamp', 'asc')
.limitOpt(limit)


sql`
  SELECT
    sub.user_id as id, sub.actionable, sub.display_name, sub.priority AS priority
    u.first_name, u.preferred_name, u.dob, u.is_vip,
    CASE WHEN (has_ops_assignee AND NOT my_assignment) THEN sub.actionable + interval '1 hour' ELSE sub.actionable END AS adjusted_timestamp
    substring(last_name from 1 for 1) AS last_initial
  FROM (
    SELECT 
      min(t.actionable) as actionable,
      max(t.priority) as priority,
      bool_or('ops' = ANY(a.roles)) AS has_ops_assignee,
      bool_or(ta.user_id = ${user_id}) AS my_assignment,
      string_agg(tt.display_name, ', ') AS display_name,
      bool_or(t.leaseee_id IS NOT NULL AND t.lease_expires_at >= now()) AS has_active_lease
    FROM ticket.ticket as t
    LEFT JOIN ticket.assignment AS ta ON t.id = ta.ticket_id
    LEFT JOIN agent AS a ON (a.user_id = ta.user_id AND ta.ticket_id is not null)
    LEFT JOIN ticket.topic as tt ON t.topic_id = tt.id
    WHERE t.state = 'open' 
      AND t.actionable IS NOT NULL
      AND (tt.id IS NULL OR tt.role = 'ops')
      GROUP BY t.user_id
  ) as sub
  JOIN "user" as u on u.id = sub.user_id
  LEFT JOIN jurisdictions as j ON j.id = u.jurisdiction_id
  WHERE has_active_lease = false
  ORDER BY priority desc, is_vip desc, adjusted_timestamp asc
  ${sql.if(limit, `LIMIT ${limit}`)}
`;







k('user')
.insert({
  email,
  password,
  is_vip,
  prefix: params.prefix,
  first_name: params.first_name,
  middle_name: params.middle_name,
  last_name: params.last_name,
  suffix: params.suffix,
  dob: params.dob,
  phone: params.phone,
  sex: params.sex,
  jurisdiction_id: params.jurisdiction.id,
  promo_code_id: params.promo_code.id,
  state,
  test,
  tags,
  dob_verification: params.dob_verification,
  name_verification: params.name_verification,
  created_at: params.created_at,
})
.returning('id')

sql`
  INSERT INTO ${sql.i('user')} ${sql.list_labels('l1')}
  VALUES ${sql.list_values('l1', {
    email,
    password,
    is_vip,
    prefix: params.prefix,
    first_name: params.first_name,
    middle_name: params.middle_name,
    last_name: params.last_name,
    suffix: params.suffix,
    dob: params.dob,
    phone: params.phone,
    sex: params.sex,
    jurisdiction_id: params.jurisdiction.id,
    promo_code_id: params.promo_code.id,
    state,
    test,
    tags,
    dob_verification: params.dob_verification,
    name_verification: params.name_verification,
    created_at: params.created_at,
  })}
  RETURNING id
`;

sql`
  INSERT INTO ${sql.i('user')} ${sql.labels()}
  VALUES ${sql.values({
    email,
    password,
    is_vip,
    prefix: params.prefix,
    first_name: params.first_name,
    middle_name: params.middle_name,
    last_name: params.last_name,
    suffix: params.suffix,
    dob: params.dob,
    phone: params.phone,
    sex: params.sex,
    jurisdiction_id: params.jurisdiction.id,
    promo_code_id: params.promo_code.id,
    state,
    test,
    tags,
    dob_verification: params.dob_verification,
    name_verification: params.name_verification,
    created_at: params.created_at,
  })
  RETURNING id
`;


k('user')
.updateDefined(
  params_to_update,
  // name parts:
  'first_name', 'last_name', 'middle_name', 'preferred_name', 'prefix', 'suffix',
  // user attributes:
  'dob', 'email', 'jurisdiction.id', 'password', 'phone', 'promo_code.id', 'sex', 'address.id',
  // business state:
  'actionable', 'is_vip', 'phone_confirmed', 'state', 'tags',
  // documents:
  'identification.id', 'prescription_insurance.id', 'profile_pic.id', 'secondary_insurance.id',
  'medical_insurance.id', 'copay_assistance.id',
  // external IDs:
  'dosespot_id',
  // T3835: temporary column
  'has_been_sent_phi_opt_in_message'
)
.update('name_verification', name_verification)
.update('dob_verification', dob_verification)
.where('id', id);

sql`
  UPDATE ${sql.i('user')}
  SET ${sql.setdefined({
    params_to_update,
    // name parts:
    'first_name', 'last_name', 'middle_name', 'preferred_name', 'prefix', 'suffix',
    // user attributes:
    'dob', 'email', 'jurisdiction.id', 'password', 'phone', 'promo_code.id', 'sex', 'address.id',
    // business state:
    'actionable', 'is_vip', 'phone_confirmed', 'state', 'tags',
    // documents:
    'identification.id', 'prescription_insurance.id', 'profile_pic.id', 'secondary_insurance.id',
    'medical_insurance.id', 'copay_assistance.id',
    // external IDs:
    'dosespot_id',
    // T3835: temporary column
    'has_been_sent_phi_opt_in_message'
  }, { trailing_comma: true })}
  name_verification=${name_verification},
  dob_verification=${dob_verification}
`;

sql`
  UPDATE "user"
  SET ${sql.set({ ...params_to_update, name_verification, dob_verification })}
`;





// TODO: split this into a mixin
static _default_select(alias, context) {
  const alias_and_delimiter = alias ? `${alias}.` : '';
  const select_columns = this._default_select_columns.map((col) => {
    if (col instanceof Function) {
      return k.raw(col(alias_and_delimiter));
    } else if (col.match(/[^0-9a-zA-Z_]+/)) {
      return k.raw(`${alias_and_delimiter}${col}`);
    } else {
      return `${alias_and_delimiter}${col}`;
    }
  });

  const table_sql = alias ? `${this.table} as ${alias}` : this.table;
  if (context) {
    return context.select(...select_columns);
  } else {
    return k(table_sql).select(...select_columns);
  }
}



const columns = this._default_select_columns.map((col) => {
  if (col instanceof Function) {
    return sql.raw(col(alias_and_delimiter));
  } else if (col.match(/[^0-9a-zA-Z_]+/)) {
    return sql.raw(`${alias_and_delimiter}${col}`);
  } else {
    return sql.i(`${alias_and_delimiter}${col}`);
  }
});

sql`
  SELECT ${sql.list(columns)}
  FROM ${sql.i(table_sql)} as ${alias}
`;


return super._default_select(alias)
.leftJoin('agent as a', 'a.user_id', `${alias}.id`)
.select(k.raw(`a.state='active' as is_agent`))
.leftJoin('checkout.cart as cart', (join_builder: k.QueryBuilder): void => {
  join_builder.on('cart.user_id', `${alias}.id`)
  .andOn(k.raw(`cart.state = '${CHECKOUT_CART_STATE.ACTIVE}'`));
})
.select('cart.id as active_cart_id');


sql`
  ${sql.raw(default_select_result)},
  a.state='active' AS is_agent,
  cart.id as active_cart_id
  LEFT JOIN agent as a ON a.user_id = ${sql.i(alias)}.id
  -- LEFT JOIN agent as a ON a.user_id = /${alias}/.id
  LEFT JOIN checkout.cart a cart ON cart.user_id = ${sql.i(alias)}.id AND cart.state = ${CHECKOUT_CART_STATE.ACTIVE}
`;










sql`
  SELECT 
      r.id, r.source, r.topic, r.details, r.state, r.bill_insurance,
      r.created_at, r.ready_at, r.incomplete_at, r.claimed_at, r.closed_at
      r.health_survey, r.note, r.approved_charge, r.external_id
      r.user_id, r.doctor_id, r.address_id, r.shipping_option_id, r.credit_card_id
      r.item_id, r.pharmacy_id, r.topic_id, r.survey_response_id
      r.transition_reason, r.transition_reason_detail, r.medical_review
      ${sql.if('has_lab_orders' in params, `, COUNT(*) AS num_lab_orders`)}
  FROM request as r
  ${sql.if(params.order_id, 'JOIN order_item ON order_item.request_id = r.id')}
  ${sql.if(params.topic_code, 'JOIN topic as t ON t.id = r.topic_id')}
  ${sql.if(params.query || params.user_age || params.jurisdiction_ids, 'JOIN "user" ON r.user_id = "user".id')}
  ${sql.if(params.address_state, 'JOIN address ON address.id = r.address_id')}
  ${sql.if('has_lab_orders' in params, 'JOIN lab_orders as lo on lo.request_id = r.id')}
  WHERE
    r.state NOT ${this.STATES.PENDING} AND
    ${
      sql.and(
        sql.cmp('r.user_id', params.user_id),
        sql.cmp('r.state', params.state),
        sql.cmp('r.state', 'in', params.states),
        sql.cmp('r.item_id', params.item_id),
        sql.cmp('r.external_id', params.external_id),
        sql.cmp('r.id', params.ids),
        sql.cmp('r.source', source_restriction),
        sql.cmp('r.topic_id', params.topic_id),
        sql.cmp('r.medical_review', 'in', params.medical_reviews),
        sql.cmp('r.medical_review', params.medical_review),
        sql.cmp('r.excluded_ids', 'not in', params.excluded_ids),
        sql.cmp('r.created_at', '>=', params.min_created_at),
        sql.cmp('r.max_created_at', '<=', 'params.max_created_at),
        sql.cmp('r.max_age', 'r.created_at', '>', 'now() - interval ${params.max_age} days'),
        sql.cmp('"user".juridiction_id', 'in', params.jurisdiction_ids),
        -- could also be done in the explicit sql.if list below
        sql.cmp('order_item.order_id', params.order_id),
        sql.cmp('t.code', params.topic_code),
      )
    }
    -- done in the sql.and above
    -- ${sql.if(params.order_id, 'AND order_item.order_id = params.order_id')}
    -- ${sql.if(params.topic_code, `AND t.code = ${params.topic_code}`)}
    ${sql.if(params.query, () => {
      const search_parts = [
        `COALESCE("user".first_name, '')`,
        `COALESCE("user".last_name, '')`,
        `COALESCE("user".email, '')`,
      ];

      if (params.address_state) {
        search_parts.push(`COALESCE(address.city, '')`);
      }

      search_parts.push(`CASE WHEN "user".dob IS NULL THEN '' ELSE to_char("user".dob, 'MM/DD/YYYY') END`);
      const query = params.query.replace(/ +/, '%');

      return `
        AND LOWER(${search_parts.join('||\' \'||')}) like LOWER(%${query}%)
        AND "user".test = false
      `;
    })}
    ${sql.if(params.user_age, () => {
      const age_min = moment().subtract(parseInt(params.user_age, 10) + 1, 'years').format('YYYY-MM-DD');
      const age_max = moment().subtract(params.user_age, 'years').format('YYYY-MM-DD');

      return `
        AND "user".dob <= ${age_max}
        AND "user".dob > ${age_min}
      `;
    })}
    ${sql.if(params.topic && !params.topic_id, `AND r.topic = ${params.topic}`)}
    ${sql.if(params.address_state, 'AND address.state = UPPER(${params.address_state})')}
    ${() => {
      if (params.state) {
        return `AND r.state = ${params.state}`;
      } else if (params.states) {
        return `AND r.state IN (${sql.list(params.states)})`;
      }
    }}
    ORDER BY r.${sql.i(params.order_by) || 'id'} ${sql.i(params.direction) || 'desc'}
    LIMIT ${params.limit || 50}
`;

if ('has_lab_orders' in params) {
  sql`
    SELECT *
    FROM ${sql.raw(query)} AS sub
    WHERE ${
      sql.if(params.has_lab_orders', 'num_lab_orders >= 0', 'num_lab_orders = 0')
    }
  `;
}







    let q =
      k('request as r')
      .select('r.id', 'r.source', 'r.topic', 'r.details', 'r.state', 'r.bill_insurance')
      .select('r.created_at', 'r.ready_at', 'r.incomplete_at', 'r.claimed_at', 'r.closed_at')
      .select('r.health_survey', 'r.note', 'r.approved_charge', 'r.external_id')
      .select('r.user_id', 'r.doctor_id', 'r.address_id', 'r.shipping_option_id', 'r.credit_card_id')
      .select('r.item_id', 'r.pharmacy_id', 'r.topic_id', 'r.survey_response_id')
      .select('r.transition_reason', 'r.transition_reason_detail', 'r.medical_review')
      .whereNot('r.state', this.STATES.PENDING)
      .whereOpt('r.user_id', params.user_id)
      .whereOpt('r.state', params.state)
      .whereInOpt('r.state', params.states)
      .whereOpt('r.item_id', params.item_id)
      // TEMP-UBIOME-HEALTH-SURVEY.begin
      .whereOpt('r.external_id', params.external_id)
      // TEMP-UBIOME-HEALTH-SURVEY.end
      .whereInOpt('r.id', params.ids)
      .whereOpt('r.source', source_restriction)
      .whereOpt('r.topic_id', params.topic_id)
      .whereInOpt('r.medical_review', params.medical_reviews)
      .whereOpt('r.medical_review', params.medical_review);

    if (params.excluded_ids) {
      q.whereNotIn('r.id', params.excluded_ids);
    }

    if (params.order_id) {
      q.leftJoin('order_item', 'order_item.request_id', 'r.id')
       .where('order_item.order_id', params.order_id);
    }

    if (params.topic_code) {
      const topic_code = this.REQUEST_TOPIC_CODE_MAP[params.topic_code] || params.topic_code;
      q.join('topic as t', 'r.topic_id', 't.id')
       .where('t.code', topic_code);
    }

    if (params.order_by) {
      q.orderBy(`r.${params.order_by}`, params.direction);
    } else {
      q.orderBy('r.id', 'desc');
    }

    if (params.limit) {
      q.limit(params.limit);
    } else if (params.limit === undefined) {
      q.limit(50);
    }

    if (params.min_created_at) {
      q.where('r.created_at', '>=', params.min_created_at);
    }

    if (params.max_created_at) {
      q.where('r.created_at', '<=', params.max_created_at);
    }

    if (params.max_age) {
      q.where('r.created_at', '>', k.raw(`now() - interval ?`, [`${params.max_age}  days`]));
    }

    if (params.query || params.user_age || params.jurisdiction_ids) {
      q.join('user', 'r.user_id', 'user.id');
    }

    if (params.jurisdiction_ids) {
      q.whereIn('user.jurisdiction_id', params.jurisdiction_ids);
    }

    if (params.query) {
      const search_parts = [
        `COALESCE("user".first_name, '')`,
        `COALESCE("user".last_name, '')`,
        `COALESCE("user".email, '')`,
      ];

      if (params.address_state) {
        search_parts.push(`COALESCE(address.city, '')`);
      }

      search_parts.push(`CASE WHEN "user".dob IS NULL THEN '' ELSE to_char("user".dob, 'MM/DD/YYYY') END`);
      const query = params.query.replace(/ +/, '%');
      q.whereRaw(`LOWER(${search_parts.join('||\' \'||')}) like LOWER(?)`, [`%${query}%`]);
      q.where('user.test', false);
    }

    if (params.user_age) {
      const age_min = moment().subtract(parseInt(params.user_age, 10) + 1, 'years').format('YYYY-MM-DD');
      const age_max = moment().subtract(params.user_age, 'years').format('YYYY-MM-DD');

      q.where('user.dob', '<=', age_max);
      q.where('user.dob', '>', age_min);
    }

    if (params.address_state) {
      q.join('address', 'r.address_id', 'address.id');
      q.where('address.state', params.address_state.toUpperCase());
    }

    // if there's a topic id defined, we should search by that instead of the topic string
    if (params.topic && !params.topic_id) {
      q.where('r.topic', params.topic);
    }

    if (params.state) {
      q.where('r.state', params.state);
    } else if (params.states) {
      q.whereInOpt('r.state', params.states);
    }

    // If we're searching for existence/lack of lab orders, augment `q` do to a count for every row returned
    // and then wrap the main query in another query so that we can filter by presence/lack of lab orders.
    if ('has_lab_orders' in params) {
      q.select((builder) =>
        builder.count('* as num_lab_orders').from('lab_order as lo').where('lo.request_id', k.raw('??', ['r.id']))
      );

      q = k.select('*').from(q.as('sub'));

      if (params.has_lab_orders) {
        q.where('sub.num_lab_orders', 0);
      } else {
        q.where('sub.num_lab_orders', '>', 0);
      }
    }
