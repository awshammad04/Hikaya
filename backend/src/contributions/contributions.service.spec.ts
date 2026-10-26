import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContributionsService } from './contributions.service';
import { LocationsService } from '../locations/locations.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';
import type { User } from '../database/entities/account.entity';

describe('ContributionsService', () => {
  let service: ContributionsService;

  const reviewer: User = {
    id: 'reviewer-1',
    fullName: 'Review Team',
    email: 'reviewer@hikaya.test',
    phone: null,
    role: 'editor',
    createdAt: new Date(),
  };

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

  it('never exposes the contributor email or account on the public list', async () => {
    await service.create(
      { ...validSubmission, contributorEmail: 'me@example.com' },
      'user-1',
    );
    const [created] = (await service.listForReview('pending_review')).items;
    await service.review(created.id, { decision: 'approved' }, reviewer);

    const published = await service.findApprovedByLocation('armenian-quarter');
    const item = published.find((entry) => entry.id === created.id);
    expect(item?.contributorName).toBe('Test Contributor');
    expect(item?.contributorEmail).toBeUndefined();
    expect(item?.userId).toBeUndefined();
    expect(item?.referenceCode).toBeUndefined();
  });

  describe('review queue', () => {
    it('lists pending submissions oldest first, with counts per status', async () => {
      const first = await service.create(validSubmission);
      const second = await service.create({
        ...validSubmission,
        title: 'Second',
      });

      const queue = await service.listForReview('pending_review');
      expect(queue.items.map((item) => item.id)).toEqual([first.id, second.id]);
      expect(queue.counts).toEqual({
        pending_review: 2,
        approved: 4,
        rejected: 0,
      });
    });

    it('keeps the contributor account out of the reviewer view', async () => {
      await service.create(validSubmission, 'user-1');
      const [item] = (await service.listForReview('pending_review')).items;
      expect(item).not.toHaveProperty('userId');
    });

    it('publishes a story once a reviewer approves it', async () => {
      const created = await service.create(validSubmission);
      const reviewed = await service.review(
        created.id,
        { decision: 'approved', notes: '  Lovely detail.  ' },
        reviewer,
      );

      expect(reviewed.status).toBe('approved');
      expect(reviewed.reviewNotes).toBe('Lovely detail.');
      expect(reviewed.reviewedBy).toBe(reviewer.id);
      expect(reviewed.reviewedAt).toBeInstanceOf(Date);
      const approved = await service.findApprovedByLocation('armenian-quarter');
      expect(approved.map((item) => item.id)).toContain(created.id);
    });

    it('requires a note to reject, and the contributor sees it', async () => {
      const created = await service.create(validSubmission);
      await expect(
        service.review(
          created.id,
          { decision: 'rejected', notes: ' ' },
          reviewer,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await service.review(
        created.id,
        { decision: 'rejected', notes: 'Names a private person.' },
        reviewer,
      );
      const status = await service.findStatus(created.referenceCode as string);
      expect(status.status).toBe('rejected');
      expect(status.reviewNotes).toBe('Names a private person.');
    });

    it('can take a published story down again', async () => {
      const created = await service.create(validSubmission);
      await service.review(created.id, { decision: 'approved' }, reviewer);
      await service.review(
        created.id,
        {
          decision: 'rejected',
          notes: 'Withdrawn at the contributor’s request.',
        },
        reviewer,
      );
      const approved = await service.findApprovedByLocation('armenian-quarter');
      expect(approved.map((item) => item.id)).not.toContain(created.id);
    });

    it('throws 404 when reviewing an unknown id', async () => {
      await expect(
        service.review('nope', { decision: 'approved' }, reviewer),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
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
