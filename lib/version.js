'use strict'


const VERSION_STRING_REGEXP =
    /^(?<majorString>\d+)\.(?<minorString>\d+)\.(?<patchString>\d+)(?:-(?<preReleaseNameString>[a-z]+)(?:\.(?<preReleaseNumberString>\d+))?)?$/;
const VERSION_NUMBER_STRING_REGEXP = /^(0|[1-9]\d*)$/;

/**
 * A Version object represents a semantic version number.
 */
export class Version {
  /**
   * @param {number} major
   * @param {number} minor
   * @param {number} patch
   * @param {string|undefined} preReleaseName
   * @param {number|undefined} preReleaseNumber
   */
  constructor(
      major, minor, patch, preReleaseName = undefined,
      preReleaseNumber = undefined) {
    isValidVersionParameters(
        major, minor, patch, preReleaseName, preReleaseNumber);

    /** @type {number} */ this.major_ = major;
    /** @type {number} */ this.minor_ = minor;
    /** @type {number} */ this.patch_ = patch;
    /** @type {string|undefined} */ this.preReleaseName_ = preReleaseName;
    /** @type {number|undefined} */ this.preReleaseNumber_ = preReleaseNumber;
  }

  /**
   * Gets the major version number.
   * @return {number} The major version number.
   */
  getMajor() {
    return this.major_;
  }

  /**
   * Gets the minor version number.
   * @return {number} The minor version number.
   */
  getMinor() {
    return this.minor_;
  }

  /**
   * Gets the patch version number.
   * @return {number} The patch version number.
   */
  getPatch() {
    return this.patch_;
  }

  /**
   * Gets the pre-release name.
   * @return {string|undefined} The pre-release name.
   */
  getPreReleaseName() {
    return this.preReleaseName_;
  }

  /**
   * Gets the pre-release number.
   * @return {number|undefined} The pre-release number.
   */
  getPreReleaseNumber() {
    return this.preReleaseNumber_;
  }

  /**
   * Gets the string representation of this version.
   * @return {string} The string representation of this version.
   * @override
   */
  toString() {
    let versionString = `${this.major_}.${this.minor_}.${this.patch_}`;
    if (this.preReleaseName_ !== undefined) {
      versionString += `-${this.preReleaseName_}`;
      if (this.preReleaseNumber_ !== undefined) {
        versionString += `.${this.preReleaseNumber_}`;
      }
    }
    return versionString;
  }
}

/**
 * Creates a Version object from the given string.
 * @param {string} versionString
 * @return {Version} The created Version object.
 */
export function createVersionFromString(versionString) {
  const versionStringMatch = VERSION_STRING_REGEXP.exec(versionString);
  if (versionStringMatch === null) {
    throw new Error('Invalid version string.');
  }

  /**
   * @typedef {{
   *  majorString: string,
   *  minorString: string,
   *  patchString: string,
   *  preReleaseNameString: string|undefined,
   *  preReleaseNumberString: string|undefined
   * }} VersionStringMatchGroups
   * @type {VersionStringMatchGroups}
   */
  const {
    majorString,
    minorString,
    patchString,
    preReleaseNameString,
    preReleaseNumberString
  } = versionStringMatch.groups;

  // Prefix 0 is not allowed in major, minor, patch, and pre-release number.
  if (VERSION_NUMBER_STRING_REGEXP.exec(majorString) === null ||
      VERSION_NUMBER_STRING_REGEXP.exec(minorString) === null ||
      VERSION_NUMBER_STRING_REGEXP.exec(patchString) === null ||
      (preReleaseNumberString !== undefined &&
       VERSION_NUMBER_STRING_REGEXP.exec(preReleaseNumberString) === null)) {
    throw new Error('Invalid version string.');
  }

  return new Version(
      Number(majorString), Number(minorString), Number(patchString),
      preReleaseNameString,
      preReleaseNumberString === undefined ? undefined :
                                             Number(preReleaseNumberString));
}

/**
 * Validates the given version parameters.
 * @param {number} major
 * @param {number} minor
 * @param {number} patch
 * @param {string|undefined} preReleaseName
 * @param {number|undefined} preReleaseNumber
 * @returns {boolean} True if the given version parameters are valid.
 */
export function isValidVersionParameters(
    major, minor, patch, preReleaseName, preReleaseNumber) {
  if (major < 0 || minor < 0 || patch < 0) {
    return false;

  } else if (
      patch !== 0 &&
      (preReleaseName !== undefined || preReleaseNumber !== undefined)) {
    return false;

  } else if (preReleaseName === undefined && preReleaseNumber !== undefined) {
    return false;

  } else {
    return true;
  }
}

/**
 * Checks if the given string is a valid version string.
 * @param {string} versionString
 * @return {boolean} True if the given string is a valid version string.
 */
export function isValidVersionString(versionString) {
  try {
    createVersionFromString(versionString);
    return true;

  } catch (error) {
    return false;
  }
}
