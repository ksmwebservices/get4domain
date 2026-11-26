import { RequestField, RequestFormData } from './request-form-core';

/**
 * The request form data: which extra questions a vendor site asks, per industry pack and per registration category. DATA, not branches: to change a question, edit a row. A category's list
 * replaces its pack's list, a pack's list replaces the default. Keys are lower case words with underscores; `name`, `phone`, `message`, `item`, `consent` and `email` are the form's own and
 * cannot be used. A test (`request-form-core.spec.ts`) checks every list.
 */
const text = (key: string, label: string, required = false): RequestField => ({ key, label, type: 'text', required });
const longtext = (key: string, label: string, required = false): RequestField => ({ key, label, type: 'longtext', required });
const date = (key: string, label: string, required = false): RequestField => ({ key, label, type: 'date', required });
const num = (key: string, label: string, required = false): RequestField => ({ key, label, type: 'number', required });
const pick = (key: string, label: string, options: string[], required = false): RequestField => ({ key, label, type: 'select', required, options });

const WHEN = ['Now, it is urgent', 'Today', 'Tomorrow', 'This week'];
const PART_OF_DAY = ['Morning', 'Afternoon', 'Evening'];

/** The category lists that share one set of questions. */
const BUILDER_FIELDS: RequestField[] = [text('site', 'Where is the site? (area, street or plot)', true), date('visit_date', 'Preferred site visit date'), pick('visit_time', 'Preferred visit time', PART_OF_DAY)];
const BUILDER_CATEGORIES = ['civil-contractor-builder', 'mason-contractor', 'property-developer-builder', 'road-earthwork-contractor', 'roofing-sheet-contractor', 'tiles-flooring-contractor', 'waterproofing-contractor'];

export const REQUEST_FORM_DATA: RequestFormData = {
  defaults: [pick('preferred_time', 'Best time to contact you', ['Morning', 'Afternoon', 'Evening', 'Any time'])],
  packs: {
    FIELD_SERVICE: [text('address', 'Address where the work is needed', true), pick('when', 'When do you need us?', WHEN)],
    VEHICLE_SERVICE: [text('vehicle', 'Vehicle make and model', true), text('registration', 'Registration number'), pick('when', 'When can you bring it?', ['Today', 'Tomorrow', 'This week', 'Need pickup'])],
    CLINIC: [date('preferred_date', 'Preferred date'), text('reason', 'Reason for the visit')],
    LAB: [text('test_needed', 'Test needed'), pick('collection', 'Sample collection', ['Visit the lab', 'Home collection'])],
    PHARMACY: [text('delivery_address', 'Delivery address'), pick('delivery', 'How do you want it?', ['Pick up', 'Home delivery'])],
    FOOD_SERVICE: [date('event_date', 'Date'), num('guests', 'Number of people')],
    HOSPITALITY_EVENTS: [date('event_date', 'Event date', true), num('guests', 'Number of guests'), text('event_type', 'Type of event')],
    PROPERTY: [text('site', 'Which project or area are you looking at?'), date('visit_date', 'Preferred site visit date'), pick('visit_time', 'Preferred visit time', PART_OF_DAY)],
    LOGISTICS: [text('pickup', 'Pickup place', true), text('drop', 'Drop place', true), date('move_date', 'Date')],
    RENTAL_FLEET: [date('pickup_date', 'Pickup date', true), date('return_date', 'Return date'), text('pickup_place', 'Pickup place')],
    EDUCATION: [text('course', 'Course or class you are asking about'), text('age_group', 'Age or class of the student')],
    MEMBERSHIP_WELLNESS: [text('goal', 'What do you want to achieve?'), pick('start', 'When do you want to start?', ['This week', 'This month', 'Just exploring'])],
    PRACTICE_LEGAL_FINANCE: [text('topic', 'What do you need help with?', true), pick('mode', 'How would you like to meet?', ['Phone call', 'Visit the office', 'Video call'])],
    AGENCY_CONSULTING: [longtext('project', 'Tell us about the project'), text('budget', 'Budget range')],
    B2B_DEALER: [text('product', 'Product you need', true), text('quantity', 'Quantity')],
  },
  categories: {
    ...Object.fromEntries(BUILDER_CATEGORIES.map((c) => [c, BUILDER_FIELDS])),
    'ambulance-service': [text('pickup_location', 'Pickup location', true), text('destination', 'Where to (hospital or address)'), pick('urgency', 'How soon?', ['Emergency, now', 'Within 1 hour', 'Planned, later today', 'Planned, another day'], true)],
    plumber: [text('address', 'Address where the work is needed', true), pick('when', 'When do you need us?', WHEN), pick('problem', 'What is the problem?', ['Leak', 'Blockage', 'New fitting', 'Motor or tank', 'Other'])],
  },
};
