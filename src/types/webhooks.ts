/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServerResponse } from 'http';
import { IncomingHttpHeaders } from 'http';
import { WAConfigType } from './config';
import {
	ConversationTypesEnum,
	CurrencyCodesEnum,
	StatusEnum,
	VideoMediaTypesEnum,
	ReferralSourceTypesEnum,
	StickerMediaTypesEnum,
	WebhookTypesEnum,
	SystemChangeTypesEnum,
	ImageMediaTypesEnum,
	DocumentMediaTypesEnum,
} from './enums';
import { BaseClass } from './base';
import {
	ContactObject as MessageContactObject,
	LocationObject,
	ReactionObject,
} from './messages';

type PricingObject = {
	category: ConversationTypesEnum;
	pricing_model: 'CBP' | 'PMP';
	billable?: boolean;
	type?: 'regular' | 'free_customer_service' | 'free_entry_point';
};

type OriginObject = {
	type: ConversationTypesEnum;
};

type ConversationObject = {
	id: string;
	origin: OriginObject;
	expiration_timestamp?: string;
};

type ErrorDataObject = {
	details: string;
};

type ErrorObject = {
	code: number;
	title: string;
	message?: string;
	error_data?: ErrorDataObject;
};

export type StatusesObject = {
	conversation?: ConversationObject;
	errors?: ErrorObject[];
	id: string;
	pricing?: PricingObject;
	recipient_id: string;
	status: StatusEnum;
	timestamp: string;
};

type AudioObject = {
	id: string;
	mime_type: string;
	sha256?: string;
	voice?: boolean;
	url?: string;
};

type ButtonObject = {
	payload: string;
	text: string;
};

type ConTextObject = {
	forwarded?: boolean;
	frequently_forwarded?: boolean;
	from?: string;
	id?: string;
	referred_product?: {
		catalog_id: string;
		product_retailer_id: string;
	};
};

type DocumentObject = {
	caption?: string;
	filename: string;
	sha256: string;
	mime_type: DocumentMediaTypesEnum;
	id: string;
};

type IdentityObject = {
	acknowledged: string;
	created_timestamp: string;
	hash: string;
};

type ImageObject = {
	caption?: string;
	sha256: string;
	id: string;
	mime_type: ImageMediaTypesEnum;
};

type ButtonReplyObject = {
	button_reply: {
		id: string;
		title: string;
	};
};

type ListReplyObject = {
	list_reply: {
		id: string;
		title: string;
		description?: string;
	};
};

type InteractiveObject =
	| ({ type: 'button_reply' } & ButtonReplyObject)
	| ({ type: 'list_reply' } & ListReplyObject)
	| {
			type: 'nfm_reply';
			nfm_reply: { name: string; body: string; response_json: string };
	  };

type ProductItemsObject = {
	product_retailer_id: string;
	quantity: string | number;
	item_price: string | number;
	currency: CurrencyCodesEnum;
};

type Order_Object = {
	catalog_id: string;
	text: string;
	product_items: ProductItemsObject[];
};

type ReferralObject = {
	source_url: string;
	source_type: ReferralSourceTypesEnum;
	source_id: string;
	headline: string;
	body: string;
	media_type?: 'image' | 'video';
	image_url?: string;
	video_url?: string;
	thumbnail_url?: string;
	ctwa_clid?: string;
};

type StickerObject = {
	mime_type: StickerMediaTypesEnum;
	sha256: string;
	id: string;
	animated: boolean;
};

type SystemObject = {
	body: string;
	identity: string;
	wa_id: string;
	type: SystemChangeTypesEnum;
	customer: string;
};

type TextObject = {
	body: string;
};

type VideoObject = {
	caption?: string;
	filename?: string;
	sha256: string;
	id: string;
	mime_type: VideoMediaTypesEnum;
};

export type MessagesObject = {
	audio?: AudioObject;
	button?: ButtonObject;
	contacts?: MessageContactObject[];
	context?: ConTextObject;
	document?: DocumentObject;
	errors?: ErrorObject[];
	from: string;
	id: string;
	identity?: IdentityObject;
	image?: ImageObject;
	interactive?: InteractiveObject;
	location?: LocationObject;
	reaction?: ReactionObject;
	order?: Order_Object;
	referral?: ReferralObject;
	sticker?: StickerObject;
	system?: SystemObject;
	text?: TextObject;
	timestamp: string;
	type: WebhookTypesEnum;
	video?: VideoObject;
};

type ProfileObject = {
	name: string;
};

type ContactObject = {
	wa_id: string;
	profile: ProfileObject;
};

type MetadataObject = {
	display_phone_number: string;
	phone_number_id: string;
};

export type ValueObject = {
	messaging_product: 'whatsapp';
	contacts?: ContactObject[];
	errors?: ErrorObject[];
	messages?: MessagesObject[];
	metadata: MetadataObject;
	statuses?: StatusesObject[];
};

type ChangesObject = {
	field: string;
	value: ValueObject;
};

type Entry_Object = {
	id: string;
	changes: ChangesObject[];
};

export type WebhookObject = {
	object: 'whatsapp_business_account';
	entry: Entry_Object[];
};

export type WebhookSubscribeQuery = {
	hub: {
		mode: 'subscribe';
		challenge: string;
		verify_token: string;
	};
};

export type WebhookCallback = (
	statusCode: number,
	headers: IncomingHttpHeaders,
	body?: WebhookObject,
	response?: ServerResponse,
	error?: Error,
) => any;

export declare class WebhooksClass extends BaseClass {
	constructor(config: WAConfigType, userAgent: string);
	start(cb: WebhookCallback): boolean;
	isStarted(): boolean;
	stop(cb: (err?: Error) => any): boolean;
}
