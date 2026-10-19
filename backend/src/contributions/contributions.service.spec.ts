import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContributionsService } from './contributions.service';
import { LocationsService } from '../locations/locations.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';

describe('ContributionsService', () => {
  let service: ContributionsService;

  const validSubmission = {
    locationId: 'armenian-quarter',
    title: 'My grandmother’s embroidery',
    content:
      'She stitched the same pattern her mother taught her, and every thread had a name we were expected to remember.',
    contributorName: 'Test Contributor',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContributionsService,
        LocationsService,
        ...IN_MEMORY_REPOSITORY_PROVIDERS,
      ],
    }).compile();

    service = module.get(ContributionsService);
  });

  it('stores a submission and returns the persisted record', async () => {
    const created = await service.create(validSubmission);
    expect(created.id).toBeTruthy();
    expect(created.locationId).toBe('armenian-quarter');
    expect(created.title).toBe(validSubmission.title);
    expect(created.submittedAt).toBeInstanceOf(Date);
  });

  it('holds every submission for review instead of publishing it', async () => {
    const created = await service.create(validSubmission);
    expect(created.status).toBe('pending_review');

    const approved = await service.findApprovedByLocation('armenian-quarter');
    expect(approved.map((item) => item.id)).not.toContain(created.id);
  });

  it('rejects a submission for a location that does not exist', async () => {
    await expect(
      service.create({ ...validSubmission, locationId: 'atlantis' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the approved seeded contributions', async () => {
    const approved = await service.findApproved();
    expect(approved).toHaveLength(4);
    expect(approved.every((item) => item.status === 'approved')).toBe(true);
  });

  describe('reference codes', () => {
    it('gives every submission a unique, readable reference code', async () => {
      const first = await service.create(validSubmission);
      const second = await service.create(validSubmission);

      expect(first.referenceCode).toMatch(
        /^HK-[23456789ACDEFGHJKLMNPQRSTVWXYZ]{6}$/,
      );
      expect(second.referenceCode).not.toBe(first.referenceCode);
    });

    it('lets a contributor check their own submission by code', async () => {
      const created = await service.create(validSubmission);
      const status = await service.findStatus(created.referenceCode as string);

      expect(status.status).toBe('pending_review');
      expect(status.title).toBe(validSubmission.title);
      expect(status.message).toContain('waiting');
      // Reviewer notes stay hidden until there is actually a decision.
      expect(status.reviewNotes).toBeNull();
    });

    it('accepts the code in lower case and with stray spacing', async () => {
      const created = await service.create(validSubmission);
      const code = created.referenceCode as string;
      const status = await service.findStatus(`  ${code.toLowerCase()} `);
      expect(status.referenceCode).toBe(code);
    });

    it('shows the reviewer note once a decision has been made', async () => {
      const status = await service.findStatus('HQ-KAAK26');
      expect(status.status).toBe('approved');
      expect(status.reviewNotes).toContain('oral memory');
    });

    it('throws 404 for a code that does not exist', async () => {
      await expect(service.findStatus('HK-NOPE99')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
